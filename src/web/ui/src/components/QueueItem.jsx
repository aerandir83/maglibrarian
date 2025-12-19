import { useState, useEffect } from 'react'
import { Check, X, Search, Edit2, Play, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

const API_BASE = "/api"

export default function QueueItem({ item, onUpdate }) {
    const [expanded, setExpanded] = useState(false)
    const [editing, setEditing] = useState(false)
    const [searching, setSearching] = useState(false)
    const [loading, setLoading] = useState(false)
    const [searchResults, setSearchResults] = useState([])
    const [formData, setFormData] = useState(item.metadata || {})

    const [showConfirm, setShowConfirm] = useState(false)
    const [previewPath, setPreviewPath] = useState("")
    const [processMode, setProcessMode] = useState('copy') // 'copy' or 'move'

    const handleProcessClick = async () => {
        setLoading(true)
        try {
            const res = await fetch(`${API_BASE}/queue/${item.id}/preview`)
            if (res.ok) {
                const data = await res.json()
                setPreviewPath(data.destination)
                setShowConfirm(true)
            } else {
                toast.error("Failed to generate preview")
            }
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    const confirmProcess = async () => {
        setShowConfirm(false)
        setLoading(true)
        const toastId = toast.loading("Processing...")
        try {
            await fetch(`${API_BASE}/queue/${item.id}/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: processMode })
            })
            toast.success("Processing started", { id: toastId })
            onUpdate()
        } catch (e) {
            toast.error("Processing request failed", { id: toastId })
        }
        setLoading(false)
    }

    const handleRemove = async () => {
        if (!window.confirm("Are you sure you want to remove this item?")) return
        try {
            await fetch(`${API_BASE}/queue/${item.id}`, { method: 'DELETE' })
            toast.success("Item removed")
            onUpdate()
        } catch (e) {
            toast.error("Failed to remove item")
        }
    }

    const [hasSearched, setHasSearched] = useState(false)

    const handleSearch = async () => {
        setSearching(true)
        setHasSearched(false)
        // Handle both forward and back slashes for path splitting
        const pathParts = item.dirpath.split(/[/\\]/)
        let folderName = pathParts.pop()
        if (!folderName && pathParts.length > 0) folderName = pathParts.pop() // Handle trailing slash

        const q = formData.title || folderName || ""
        try {
            const res = await fetch(`${API_BASE}/queue/${item.id}/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: q,
                    author: formData.author,
                    audible_id: formData.asin
                })
            })
            const data = await res.json()
            setSearchResults(data)
            setHasSearched(true)
        } catch (e) {
            console.error(e)
            toast.error("Search failed. Check console.")
        }
        setSearching(false)
    }

    const applyMatch = async (match) => {
        const updates = {
            title: match.title,
            author: match.author,
            year: match.year,
            isbn: match.isbn,
            asin: match.asin,
            description: match.description,
            cover_url: match.cover_url
        }
        setFormData({ ...formData, ...updates })
        await saveUpdates(updates)
        setSearchResults([])
        toast.success("Metadata match applied")
    }

    // Sync formData with item.metadata when item changes from parent poll
    useEffect(() => {
        if (!editing && !searching) {
            setFormData(item.metadata || {})
        }
    }, [item, editing, searching])

    const saveUpdates = async (data = formData) => {
        try {
            const res = await fetch(`${API_BASE}/queue/${item.id}/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })

            if (!res.ok) {
                const errText = await res.text()
                toast.error(`Save failed: ${errText}`)
                return
            } else {
                const updated = await res.json()
                setFormData(updated.metadata || {})
                if (data === formData) toast.success("Changes saved") // Only show if manual save
            }
        } catch (e) {
            console.error("Error during save:", e)
            toast.error(`Error during save: ${e.message}`)
            return
        }

        if (onUpdate) onUpdate()
        setEditing(false)
    }

    const confidenceColor = (score) => {
        if (score >= 90) return 'text-green-400';
        if (score >= 70) return 'text-yellow-400';
        return 'text-red-400';
    }

    return (
        <div className={`bg-card border border-border rounded-xl p-6 shadow-sm relative transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}>
            {showConfirm && (
                <div className="absolute inset-0 bg-black/90 z-10 rounded-xl flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                    <h3 className="text-lg font-bold mb-2">Confirm Processing</h3>
                    <p className="text-sm text-muted mb-4">The files will be moved to:</p>
                    <div className="bg-slate-900 p-3 rounded w-full break-all font-mono text-xs mb-6 border border-border">
                        {previewPath}
                    </div>

                    <div className="flex gap-6 mb-6">
                        <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                            <input type="radio" name={`mode-${item.id}`} value="copy" checked={processMode === 'copy'} onChange={(e) => setProcessMode(e.target.value)} className="accent-primary" />
                            <span>Copy</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                            <input type="radio" name={`mode-${item.id}`} value="move" checked={processMode === 'move'} onChange={(e) => setProcessMode(e.target.value)} className="accent-primary" />
                            <span>Move</span>
                        </label>
                    </div>

                    <div className="flex gap-2">
                        <button className="btn hover:bg-white/10 text-muted hover:text-white" onClick={() => setShowConfirm(false)}>Cancel</button>
                        <button className="btn bg-primary text-slate-900 hover:bg-primary-hover border-none" onClick={confirmProcess}>
                            <Check size={16} /> Confirm & {processMode === 'move' ? 'Move' : 'Copy'}
                        </button>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4 flex-1">
                    <div className="w-[50px] h-[75px] bg-slate-800 rounded overflow-hidden flex-shrink-0 flex items-center justify-center border border-border">
                        {formData.cover_url ? <img src={formData.cover_url} alt="Cover" className="w-full h-full object-cover" /> : <span className="text-[10px] text-muted p-1 text-center">No Cover</span>}
                    </div>

                    <div>
                        <h3 className="text-lg font-bold">{formData.title || "Unknown Title"}</h3>
                        <p className="text-muted">{formData.author || "Unknown Author"} {formData.year && `(${formData.year})`}</p>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${item.status === 'processing' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-sky-500/10 text-sky-500'}`}>
                                {item.status}
                            </span>
                            <span className={`text-xs ${confidenceColor(formData.confidence)}`}>
                                Confidence: {Math.round(formData.confidence || 0)}%
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button className="btn bg-primary text-slate-900 hover:bg-primary-hover border-none" onClick={handleProcessClick} title="Start Processing" disabled={loading}>
                        <Play size={18} />
                    </button>
                    <button className="btn hover:bg-white/5 text-muted hover:text-white" onClick={() => setExpanded(!expanded)}>
                        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="mt-4 border-t border-border pt-4 animate-fade-in">
                    <div className="flex gap-2 mb-4">
                        <button className="btn hover:bg-white/5 text-muted hover:text-white" onClick={() => setEditing(!editing)}>
                            <Edit2 size={16} /> {editing ? 'Cancel Edit' : 'Edit Metadata'}
                        </button>
                        <button className="btn hover:bg-white/5 text-muted hover:text-white" onClick={handleSearch} disabled={searching}>
                            {searching ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />} Search Match
                        </button>
                        <div className="flex-1"></div>
                        <button className="btn hover:bg-red-500/10 text-red-400 hover:text-red-300" onClick={handleRemove}>
                            <X size={16} /> Ignore
                        </button>
                    </div>

                    {searchResults.length > 0 && (
                        <div className="mb-4 bg-slate-900/50 p-4 rounded-xl border border-border">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-sm font-bold text-muted">Search Results</h4>
                                <button className="btn p-1 h-auto text-muted hover:text-white" onClick={() => setSearchResults([])}><X size={14} /></button>
                            </div>
                            <div className="flex flex-col gap-2">
                                {searchResults.map((res, i) => (
                                    <div key={i} className="flex justify-between items-center p-2 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors">
                                        <div className="flex gap-3">
                                            {res.cover_url && <img src={res.cover_url} className="w-[30px] h-[45px] object-cover rounded" />}
                                            <div>
                                                <div className="font-bold text-sm">{res.title}</div>
                                                <div className="text-xs text-muted">by {res.author} ({res.year})</div>
                                            </div>
                                        </div>
                                        <button className="btn text-xs py-1 px-2 hover:bg-primary/10 text-primary" onClick={() => applyMatch(res)}>Apply</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {hasSearched && searchResults.length === 0 && (
                        <div className="text-sm text-center p-4 text-muted bg-slate-900/50 rounded-lg mb-4">
                            No matches found. Try editing the title or author manually to improve search results.
                        </div>
                    )}

                    {editing ? (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-muted block mb-1">Title</label>
                                <input className="bg-slate-900 border border-border text-slate-200 px-3 py-2 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                    value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs text-muted block mb-1">Author</label>
                                <input className="bg-slate-900 border border-border text-slate-200 px-3 py-2 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                    value={formData.author || ''} onChange={e => setFormData({ ...formData, author: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs text-muted block mb-1">Year</label>
                                <input className="bg-slate-900 border border-border text-slate-200 px-3 py-2 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                    value={formData.year || ''} onChange={e => setFormData({ ...formData, year: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs text-muted block mb-1">Series</label>
                                <input className="bg-slate-900 border border-border text-slate-200 px-3 py-2 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                    value={formData.series || ''} onChange={e => setFormData({ ...formData, series: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs text-muted block mb-1">ISBN</label>
                                <input className="bg-slate-900 border border-border text-slate-200 px-3 py-2 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                    value={formData.isbn || ''} onChange={e => setFormData({ ...formData, isbn: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs text-muted block mb-1">Audible ID (ASIN)</label>
                                <input className="bg-slate-900 border border-border text-slate-200 px-3 py-2 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                    value={formData.asin || ''} onChange={e => setFormData({ ...formData, asin: e.target.value })} placeholder="B0..." />
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs text-muted block mb-1">Description</label>
                                <textarea className="bg-slate-900 border border-border text-slate-200 px-3 py-2 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                    rows={3} value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                            </div>
                            <div className="col-span-2">
                                <button className="btn bg-primary text-slate-900 w-full hover:bg-primary-hover font-bold py-2" onClick={() => saveUpdates()}>Save Changes</button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="col-span-2"><span className="text-muted">Path:</span> <br /><span className="text-xs font-mono break-all text-slate-400">{item.dirpath}</span></div>
                            <div><span className="text-muted">ISBN:</span> {formData.isbn || '-'}</div>
                            <div><span className="text-muted">ASIN:</span> {formData.asin || '-'}</div>
                            <div><span className="text-muted">Source:</span> {formData.source || 'Unknown'}</div>
                            {formData.description && (
                                <div className="col-span-2 max-h-[100px] overflow-y-auto pr-2"><span className="text-muted">Description:</span> <br />{formData.description}</div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
