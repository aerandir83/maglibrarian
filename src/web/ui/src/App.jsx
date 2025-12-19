import { useState, useEffect } from 'react'
import { Book, RefreshCw, Check, X, Search, Settings } from 'lucide-react'
import QueueItem from './components/QueueItem'
import { Toaster, toast } from 'sonner'

const API_BASE = "/api"

export default function App() {
    const [items, setItems] = useState([])
    const [stats, setStats] = useState({})
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState(null)

    const fetchQueue = async () => {
        try {
            const res = await fetch(`${API_BASE}/queue`)
            if (!res.ok) throw new Error("Failed to connect to API")
            const data = await res.json()
            // Sort items: processing first, then ID desc
            const sorted = data.sort((a, b) => {
                if (a.status === 'processing' && b.status !== 'processing') return -1;
                if (b.status === 'processing' && a.status !== 'processing') return 1;
                return b.id.localeCompare(a.id);
            })
            setItems(sorted)
            setLoading(false)
            setError(null)
        } catch (e) {
            console.error(e)
            setError("Could not connect to AutoLibrarian API. Is it running?")
            setLoading(false)
        }
    }

    const fetchStatus = async () => {
        try {
            const res = await fetch(`${API_BASE}/status`)
            if (res.ok) {
                setStats(await res.json())
            }
        } catch (e) { }
    }

    const handleRefresh = async () => {
        setRefreshing(true)
        toast.info("Rescanning folder...")
        try {
            await fetch(`${API_BASE}/refresh`, { method: 'POST' })
            // Give it a moment to trigger scan
            setTimeout(() => {
                fetchStatus()
                setRefreshing(false)
                toast.success("Scan started")
            }, 1000)
        } catch (e) {
            console.error(e)
            setRefreshing(false)
            toast.error("Failed to trigger scan")
        }
    }

    useEffect(() => {
        fetchQueue()
        fetchStatus()
        const interval = setInterval(() => {
            fetchQueue()
            fetchStatus()
        }, 5000)
        return () => clearInterval(interval)
    }, [])

    const pendingCount = (stats.tracked_files_count || 0) + (stats.grouping_files_count || 0)

    return (
        <div className="max-w-6xl mx-auto p-8 w-full">
            <Toaster position="top-right" theme="dark" />
            <header className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-sky-500 to-blue-500">
                        <Book color="white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold m-0">MagLibrarian</h1>
                        <span className="text-sm text-muted">Auto-Organizer Dashboard</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {pendingCount > 0 && (
                        <div className="text-sm text-muted flex items-center gap-2 animate-pulse">
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Processing {pendingCount} new files...</span>
                        </div>
                    )}
                    <button className="btn hover:bg-white/5 text-muted hover:text-white" onClick={handleRefresh} disabled={refreshing}>
                        <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
                        {refreshing ? "Scanning..." : "Rescan Folder"}
                    </button>
                </div>
            </header>

            <main>
                <div className="flex justify-between items-end mb-4">
                    <h2 className="text-lg font-semibold">Processing Queue ({items.length})</h2>
                    <div className="text-sm text-muted">
                        {stats.tracked_files_count > 0 && <span className="mr-4">Stabilizing: {stats.tracked_files_count}</span>}
                        {stats.groups_count > 0 && <span>Grouping: {stats.groups_count}</span>}
                    </div>
                </div>

                {error && (
                    <div className="bg-card border border-rose-900/50 text-red-400 p-6 rounded-xl shadow-sm mb-4">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="text-muted text-center p-8">Loading...</div>
                ) : items.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-12 text-center shadow-sm">
                        <div className="bg-white/5 inline-flex p-4 rounded-full mb-4">
                            <Check size={32} className="text-green-500" />
                        </div>
                        <p className="text-muted text-lg">All caught up! No items pending review.</p>
                        <p className="text-sm text-muted mt-2">
                            Any new books detected will appear here.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {items.map(item => (
                            <QueueItem key={item.id} item={item} onUpdate={fetchQueue} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}
