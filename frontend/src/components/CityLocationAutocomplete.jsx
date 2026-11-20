import { useEffect, useId, useState } from 'react'
import './CityLocationAutocomplete.css'
import SkeletonLoader from './SkeletonLoader.jsx'

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5116/api').replace(/\/$/, '')

function getDisplayName(location) {
    return location?.displayName || [location?.city, location?.state].filter(Boolean).join(', ')
}

export default function CityLocationAutocomplete({
    value = '',
    onChange,
    onSelect,
    onFocus,
    onBlur,
    onKeyDown,
    id,
    name,
    placeholder = 'Start typing a city',
    ariaLabel = 'City and state',
    autoComplete = 'address-level2',
    maxLength = 150,
    required = false,
    disabled = false,
    className = '',
    inputClassName = '',
}) {
    const listId = useId()
    const [isOpen, setIsOpen] = useState(false)
    const [suggestions, setSuggestions] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [lookupFailed, setLookupFailed] = useState(false)
    const [hasSearched, setHasSearched] = useState(false)
    const [activeIndex, setActiveIndex] = useState(-1)

    const query = String(value ?? '').trim()
    const lookupTerm = query.split(',')[0].trim()
    const shouldSearch = isOpen &&
        lookupTerm.length >= 2 &&
        !/^remote\b/i.test(lookupTerm)

    useEffect(() => {
        if (!shouldSearch) return undefined

        const controller = new AbortController()

        const timeoutId = window.setTimeout(async () => {
            setIsLoading(true)

            try {
                const params = new URLSearchParams({
                    q: lookupTerm,
                    limit: '8',
                })

                const response = await fetch(
                    `${API_URL}/locations/search?${params.toString()}`,
                    {
                        headers: { Accept: 'application/json' },
                        signal: controller.signal,
                    }
                )

                if (!response.ok) {
                    throw new Error(`Location search failed (${response.status}).`)
                }

                const data = await response.json()

                if (!controller.signal.aborted) {
                    setSuggestions(
                        Array.isArray(data)
                            ? data.filter(item => getDisplayName(item))
                            : []
                    )
                    setHasSearched(true)
                    setActiveIndex(-1)
                }
            } catch (error) {
                if (error.name !== 'AbortError' && !controller.signal.aborted) {
                    setSuggestions([])
                    setHasSearched(true)
                    setLookupFailed(true)
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false)
                }
            }
        }, 250)

        return () => {
            window.clearTimeout(timeoutId)
            controller.abort()
        }
    }, [lookupTerm, shouldSearch])

    function chooseSuggestion(location) {
        const displayName = getDisplayName(location)

        if (!displayName) return

        onChange?.(displayName)
        onSelect?.({ ...location, displayName })

        setSuggestions([])
        setHasSearched(false)
        setIsLoading(false)
        setIsOpen(false)
        setActiveIndex(-1)
    }

    function handleKeyDown(event) {
        if (event.key === 'ArrowDown' && suggestions.length) {
            event.preventDefault()

            setActiveIndex(current =>
                current >= suggestions.length - 1 ? 0 : current + 1
            )
            return
        }

        if (event.key === 'ArrowUp' && suggestions.length) {
            event.preventDefault()

            setActiveIndex(current =>
                current <= 0 ? suggestions.length - 1 : current - 1
            )
            return
        }

        if (event.key === 'Enter' && isOpen && suggestions.length) {
            event.preventDefault()

            chooseSuggestion(
                suggestions[activeIndex >= 0 ? activeIndex : 0]
            )
            return
        }

        if (event.key === 'Escape') {
            setIsOpen(false)
            setActiveIndex(-1)
            return
        }

        onKeyDown?.(event)
    }

    const showMenu = isOpen && (
        shouldSearch && (
            isLoading ||
            suggestions.length > 0 ||
            (hasSearched && !lookupFailed)
        )
    )

    return (
        <div className={`hf-city-autocomplete ${className}`.trim()}>
            <input
                id={id}
                name={name}
                type="text"
                role="combobox"
                aria-label={ariaLabel}
                aria-autocomplete="list"
                aria-expanded={Boolean(showMenu)}
                aria-controls={listId}
                aria-activedescendant={
                    activeIndex >= 0
                        ? `${listId}-${activeIndex}`
                        : undefined
                }
                autoComplete={autoComplete}
                maxLength={maxLength}
                required={required}
                disabled={disabled}
                value={value}
                placeholder={placeholder}
                className={`hf-city-autocomplete__input ${inputClassName}`.trim()}
                onChange={event => {
                    onChange?.(event.target.value)
                    setSuggestions([])
                    setHasSearched(false)
                    setLookupFailed(false)
                    setIsLoading(false)
                    setIsOpen(true)
                    setActiveIndex(-1)
                }}
                onFocus={event => {
                    setLookupFailed(false)
                    setIsOpen(true)
                    onFocus?.(event)
                }}
                onBlur={event => {
                    setIsOpen(false)
                    setSuggestions([])
                    setHasSearched(false)
                    setLookupFailed(false)
                    setIsLoading(false)
                    setActiveIndex(-1)
                    onBlur?.(event)
                }}
                onKeyDown={handleKeyDown}
            />

            {showMenu && (
                <div
                    className="hf-city-autocomplete__menu"
                    id={listId}
                    role="listbox"
                    aria-label="Indian city suggestions"
                >
                    {isLoading && (
                        <SkeletonLoader
                            variant="notifications"
                            count={2}
                            compact
                            className="hf-city-autocomplete__loading"
                        />
                    )}

                    {!isLoading && suggestions.map((location, index) => (
                        <button
                            id={`${listId}-${index}`}
                            key={location.id ?? `${location.city}-${location.state}-${index}`}
                            type="button"
                            role="option"
                            aria-selected={activeIndex === index}
                            className={`hf-city-autocomplete__option ${activeIndex === index ? 'is-active' : ''}`}
                            onMouseDown={event => event.preventDefault()}
                            onClick={() => chooseSuggestion(location)}
                        >
                            <strong>
                                {location.city || getDisplayName(location)}
                            </strong>

                            <span>
                                {location.state || 'India'}
                            </span>
                        </button>
                    ))}

                    {!isLoading && hasSearched && !lookupFailed && suggestions.length === 0 && (
                        <div
                            className="hf-city-autocomplete__status"
                            role="status"
                        >
                            No matching city found. You can still enter a location manually.
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}