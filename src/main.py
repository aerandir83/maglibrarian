import time
import logging
import sys
import os
import threading
import uvicorn
import json
from concurrent.futures import ThreadPoolExecutor

from src.config import config
from src.monitor import Monitor
from src.ingest import IngestionManager
from src.identifier import Identifier, IdentificationResult
from src.providers import MetadataAggregator
from src.organizer import Organizer
from src.dependencies import queue_manager
from src.history import HistoryManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("AutoLibrarian")

class AutoLibrarian:
    def __init__(self):
        self.identifier = Identifier()
        self.aggregator = MetadataAggregator()
        self.organizer = Organizer()
        # project_root assumption: parent of current_dir (src)
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.history = HistoryManager(os.path.join(project_root, "history.db"))
        self.executor = ThreadPoolExecutor(max_workers=config.MAX_WORKERS if hasattr(config, 'MAX_WORKERS') else 4)
        
        # Ingestion Manager callback -> Processing Pipeline
        self.ingestion = IngestionManager(self.process_book)
        
        # Monitor callback -> Ingestion Manager
        self.monitor = Monitor(config.INPUT_DIR, self.ingestion.process_file)
        queue_manager.set_monitor(self.monitor)
        queue_manager.set_history_manager(self.history)
        queue_manager.register_status_callback("monitor", self.monitor.get_stats)
        queue_manager.register_status_callback("ingestion", self.ingestion.get_stats)
        

    def restore_queue(self):
        logger.info("Restoring pending items from history...")
        pending_items = self.history.get_all_pending()
        for item in pending_items:
            try:
                # Reconstruct keys
                dirpath = item['path']
                files = json.loads(item['file_list'])
                meta_json = json.loads(item['metadata']) if item['metadata'] else {}
                
                # Reconstruct Metadata Object
                metadata = IdentificationResult(**meta_json)
                
                # Add to queue without re-triggering history update
                queue_manager.add_item(dirpath, files, metadata, from_history=True)
                logger.info(f"Restored {dirpath} to queue.")
            except Exception as e:
                logger.error(f"Failed to restore item {item.get('path')}: {e}")

    def start_api(self):
        # Disable reload in production usually
        uvicorn.run("src.web.api:app", host="0.0.0.0", port=config.API_PORT, log_level="info", reload=False)

    def start(self):
        logger.info("Starting AutoLibrarian...")
        logger.info(f"Input Directory: {config.INPUT_DIR}")
        logger.info(f"Output Directory: {config.OUTPUT_DIR}")
        
        self.restore_queue()
        
        if config.WEB_UI_ENABLED:
            logger.info(f"Starting Web API on port {config.API_PORT}")
            api_thread = threading.Thread(target=self.start_api, daemon=True)
            api_thread.start()
            # Frontend is now served as static files via FastAPI or external server
        
        self.monitor.start()
        
        try:
            while True:
                time.sleep(1)
                self.monitor.tick()
                self.ingestion.tick()
        except KeyboardInterrupt:
            logger.info("Stopping...")
            self.monitor.stop()
            self.executor.shutdown(wait=False)

    def process_book(self, dirpath, files):
        # History Check
        # If item is pending or processed and hash matches, skip.
        # Check against History Manager
        state = self.history.get_state(dirpath)
        current_hash = self.history.calculate_hash(dirpath, files)
        
        if state:
            if state['content_hash'] == current_hash and state['status'] in ['pending', 'processed']:
                logger.info(f"Skipping {dirpath} - already {state['status']} and unchanged.")
                return
            elif state['content_hash'] != current_hash:
                 logger.info(f"File content changed for {dirpath}. Re-processing.")
        
        logger.info(f"Processing book group from {dirpath}")
        
        try:
            # 1. Identification
            initial_metadata = self.identifier.identify(dirpath, files)
            logger.info(f"Initial ID: {initial_metadata}")
            
            # 2. Metadata Enrichment (API)
            final_metadata = self.aggregator.enrich(initial_metadata)
            logger.info(f"Final Metadata: {final_metadata}")
            
            # Web UI Interception
            if config.WEB_UI_ENABLED:
                logger.info("Adding to processing queue for Web UI review")
                # Add to queue manager (which syncs to history as 'pending')
                queue_manager.add_item(dirpath, files, final_metadata)
                return

            # Confidence Check
            if final_metadata.confidence < config.MATCH_THRESHOLD_PROBABLE:
                logger.warning(f"Confidence score {final_metadata.confidence} below threshold. Moving to Manual Intervention.")
                self.organizer.move_to_manual(dirpath, files, final_metadata)
                # Mark as processed? Yes, managed manually now.
                self.history.update_state(dirpath, current_hash, 'processed', files, final_metadata)
                return

            # 3. Organization & Move (Async)
            # Submit to ThreadPool
            self.executor.submit(self._run_organize, dirpath, files, final_metadata, current_hash)
            
        except Exception as e:
            logger.error(f"Error processing book: {e}", exc_info=True)
            # Move to manual intervention folder?

    def _run_organize(self, dirpath, files, metadata, current_hash):
        try:
             self.organizer.organize(dirpath, files, metadata)
             # Mark as processed
             self.history.update_state(dirpath, current_hash, 'processed', files, metadata)
             
             # 4. Notify ABS
             self.notify_abs()
        except Exception as e:
             logger.error(f"Async organization failed for {dirpath}: {e}")

    def notify_abs(self):
        url = f"{config.ABS_URL}/api/libraries/scan" 
        headers = {"Authorization": f"Bearer {config.ABS_API_KEY}"} if config.ABS_API_KEY else {}
        
        try:
             # Try simple scan all if supported, or just log if no ID
             logger.info("Triggering ABS Scan...")
             pass 
        except Exception as e:
             logger.error(f"Failed to trigger ABS scan: {e}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="AutoLibrarian")
    parser.add_argument("--dry-run", action="store_true", help="Run in dry mode without modifying files")
    args = parser.parse_args()

    if args.dry_run:
        config.DRY_RUN = True
        logger.info("Dry run mode enabled via CLI")

    app = AutoLibrarian()
    app.start()
