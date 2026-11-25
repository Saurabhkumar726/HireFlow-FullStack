import './LiveToastContainer.css'

export default function LiveToastContainer({ toasts = [], onDismiss }) {
    if (!toasts.length) return null

    function getIcon(type) {
        switch (type) {
            case 'OfferAccepted': return '🎊'
            case 'OfferDeclined': return '⚠️'
            case 'OfferIssued': return '📜'
            case 'ApplicationReceived': return '📄'
            case 'ScorecardSaved': return '⭐'
            case 'StatusUpdated': return '🔄'
            default: return '⚡'
        }
    }

    return (
        <aside className="hf-toast-container" aria-label="Live updates notification area" aria-live="polite">
            {toasts.map((toast) => (
                <div key={toast.id} className={`hf-toast hf-toast-${toast.type?.toLowerCase() || 'general'}`} role="status">
                    <span className="hf-toast-icon" aria-hidden="true">{getIcon(toast.type)}</span>
                    <div className="hf-toast-content">
                        <strong className="hf-toast-title">{toast.title}</strong>
                        <p className="hf-toast-msg">{toast.message}</p>
                    </div>
                    <button
                        type="button"
                        className="hf-toast-dismiss"
                        onClick={() => onDismiss?.(toast.id)}
                        aria-label="Dismiss notification"
                    >
                        ✕
                    </button>
                </div>
            ))}
        </aside>
    )
}
