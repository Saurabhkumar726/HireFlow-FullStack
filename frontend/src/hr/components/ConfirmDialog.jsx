
import { useEffect } from 'react';
import './ConfirmDialog.css';

export default function ConfirmDialog({
    open,
    title = 'Are you sure?',
    message = 'This action cannot be undone.',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    danger = true,
    loading = false,
    onConfirm,
    onCancel,
}) {
    useEffect(() => {
        if (!open) return;

        function handleKeyDown(event) {
            if (event.key === 'Escape' && !loading) {
                onCancel?.();
            }
        }

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open, loading, onCancel]);

    if (!open) return null;

    return (
        <div
            className="confirm-dialog-backdrop"
            onMouseDown={(event) => {
                if (
                    event.target === event.currentTarget &&
                    !loading
                ) {
                    onCancel?.();
                }
            }}
        >
            <section
                className="confirm-dialog"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                aria-describedby="confirm-dialog-message"
            >
                <div
                    className={`confirm-dialog-icon ${danger ? 'is-danger' : 'is-neutral'
                        }`}
                    aria-hidden="true"
                >
                    {danger ? (
                        <svg viewBox="0 0 24 24" fill="none">
                            <path
                                d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="none">
                            <circle
                                cx="12"
                                cy="12"
                                r="9"
                                stroke="currentColor"
                                strokeWidth="1.8"
                            />
                            <path
                                d="M12 11v5m0-8h.01"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                        </svg>
                    )}
                </div>

                <h2 id="confirm-dialog-title">{title}</h2>

                <p id="confirm-dialog-message">{message}</p>

                <div className="confirm-dialog-actions">
                    <button
                        type="button"
                        className="confirm-dialog-cancel"
                        onClick={onCancel}
                        disabled={loading}
                    >
                        {cancelText}
                    </button>

                    <button
                        type="button"
                        className={`confirm-dialog-submit ${danger ? 'is-danger' : ''
                            }`}
                        onClick={onConfirm}
                        disabled={loading}
                    >
                        {loading && (
                            <span
                                className="confirm-dialog-spinner"
                                aria-hidden="true"
                            />
                        )}

                        {loading ? 'Please wait…' : confirmText}
                    </button>
                </div>
            </section>
        </div>
    );
}
