from typing import List, Dict, Optional
import threading
from pydantic import BaseModel, Field

class QueueItem(BaseModel):
    id: str
    dirpath: str
    files: List[str]
    metadata: Optional[object] = None # Will hold IdentificationResult
    status: str = "pending" # pending, processing, approved, rejected, completed

    class Config:
        arbitrary_types_allowed = True

    @staticmethod
    def create(dirpath: str, files: List[str], metadata=None, status="pending"):
        item_id = str(hash(dirpath))
        return QueueItem(id=item_id, dirpath=dirpath, files=files, metadata=metadata, status=status)

    def to_dict(self):
        # Manual dict conversion specifically to handle metadata dictionary serialization if needed
        # Or simple rely on .dict()
        return self.dict()

class QueueManager:
    def __init__(self):
        self._queue: Dict[str, QueueItem] = {}
        self._lock = threading.Lock()
        self.monitor = None
        self.status_callbacks = {}

    def set_monitor(self, monitor):
        self.monitor = monitor

    def set_history_manager(self, history_manager):
        self.history_manager = history_manager

    def refresh_monitor(self):
        if self.monitor:
            self.monitor.scan_existing_files()

    def register_status_callback(self, name, callback):
        self.status_callbacks[name] = callback

    def get_system_status(self):
        status = {}
        for name, cb in self.status_callbacks.items():
            try:
                status.update(cb())
            except Exception:
                pass
        return status
    
    def add_item(self, dirpath: str, files: List[str], metadata=None, from_history=False) -> str:
        with self._lock:
            item = QueueItem.create(dirpath, files, metadata)
            # Prevent duplicates if ID exists, but update if needed
            self._queue[item.id] = item
            
            # If adding fresh item, sync to history if manager present and not restoring
            if hasattr(self, 'history_manager') and self.history_manager and not from_history:
                 # Calculate hash effectively or assume caller handled it?
                 # Caller (AutoLibrarian) handles history creation usually.
                 # But if we want to ensure sync:
                 hash_val = self.history_manager.calculate_hash(dirpath, files)
                 self.history_manager.update_state(dirpath, hash_val, "pending", files, metadata)
            
            return item.id

    def get_items(self) -> List[Dict]:
        with self._lock:
            # We used to do item.to_dict() which called metadata.__dict__
            # QueueItem(BaseModel).dict() will recursively convert metadata if it's a Pydantic model
            return [item.dict() for item in self._queue.values()]

    def get_item(self, item_id: str) -> Optional[QueueItem]:
        with self._lock:
            return self._queue.get(item_id)

    def mark_processed(self, item_id: str):
        with self._lock:
            item = self._queue.get(item_id)
            if item and self.history_manager:
                item.status = "processed"
                hash_val = self.history_manager.calculate_hash(item.dirpath, item.files)
                self.history_manager.update_state(item.dirpath, hash_val, "processed", item.files, item.metadata)
                
    def mark_ignored(self, item_id: str):
        with self._lock:
            item = self._queue.get(item_id)
            if item and self.history_manager:
                item.status = "ignored"
                hash_val = self.history_manager.calculate_hash(item.dirpath, item.files)
                self.history_manager.update_state(item.dirpath, hash_val, "ignored", item.files, item.metadata)

    def update_item(self, item_id: str, **kwargs):
        with self._lock:
            item = self._queue.get(item_id)
            if item:
                for k, v in kwargs.items():
                    setattr(item, k, v)
                
                # Sync to history
                if hasattr(self, 'history_manager') and self.history_manager:
                    hash_val = self.history_manager.calculate_hash(item.dirpath, item.files)
                    self.history_manager.update_state(item.dirpath, hash_val, item.status, item.files, item.metadata)
                
                return True
            return False

    def remove_item(self, item_id: str):
        with self._lock:
            if item_id in self._queue:
                item = self._queue[item_id]
                del self._queue[item_id]
