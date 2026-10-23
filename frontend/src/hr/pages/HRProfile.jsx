
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import ConfirmDialog from '../components/ConfirmDialog';
import './HRProfile.css';

const API_URL = 'http://localhost:5116/api';
const API_ORIGIN = 'http://localhost:5116';
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function getInitials(name = '') {
    return name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('') || 'HR';
}

function getName(user) {
    return user?.fullName || user?.FullName || '';
}

function getEmail(user) {
    return user?.email || user?.Email || '';
}

function getPictureUrl(user) {
    const url = user?.profilePictureUrl || user?.ProfilePictureUrl || '';

    if (!url) return '';

    if (/^https?:\/\//i.test(url)) return url;

    return `${API_ORIGIN}/${url.replace(/^\/+/, '')}`;
}

async function readResponse(response) {
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.message ||
            data.title ||
            `Request failed (${response.status}).`
        );
    }

    return data;
}

export default function HRProfile() {
    const { user, token, updateUser } = useAuth();

    const fileInputRef = useRef(null);
    const previewUrlRef = useRef('');

    const [fullName, setFullName] = useState(() => getName(user));
    const [company, setCompany] = useState(() => user?.company || '');
    const [phone, setPhone] = useState(
        () => user?.phone || user?.phoneNumber || ''
    );
    const [jobTitle, setJobTitle] = useState(() => user?.jobTitle || '');
    const [location, setLocation] = useState(() => user?.location || '');
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [photoBusy, setPhotoBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
    const [confirmDeletePhoto, setConfirmDeletePhoto] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [zoom, setZoom] = useState(1);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);

    const email = getEmail(user);
    const role = user?.role || user?.Role || 'HR';
    const profilePictureUrl = getPictureUrl(user);

    // Restore the profile from the database when the signed-in account loads.
    // This ensures the saved photo is available after logout/login or refresh.
    useEffect(() => {
        if (!token || !user) return;

        let cancelled = false;

        async function loadSavedProfile() {
            try {
                const response = await fetch(`${API_URL}/Profile`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                const data = await readResponse(response);

                if (cancelled) return;

                const savedPictureUrl =
                    data.profilePictureUrl ??
                    data.ProfilePictureUrl ??
                    null;

                const savedName =
                    data.fullName ||
                    data.FullName ||
                    '';

                const savedPhone =
                    data.phoneNumber ??
                    data.PhoneNumber ??
                    '';

                updateUser({
                    profilePictureUrl: savedPictureUrl,
                    ...(savedName ? { fullName: savedName } : {}),
                    phoneNumber: savedPhone,
                });

                setFullName(savedName || getName(user));
                setPhone(savedPhone || user?.phone || user?.phoneNumber || '');
            } catch (profileError) {
                if (!cancelled) {
                    console.error(
                        'Could not refresh the saved HR profile:',
                        profileError
                    );
                }
            }
        }

        loadSavedProfile();

        return () => {
            cancelled = true;
        };

        // updateUser is omitted intentionally because AuthProvider currently
        // creates a new function on each render. The account ID and token
        // determine when this profile should be fetched again.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, user?.id, user?.Id]);

    useEffect(() => {
        return () => {
            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
            }
        };
    }, []);

    function clearFeedback() {
        setMessage('');
        setError('');
    }

    function resetForm() {
        setFullName(getName(user));
        setCompany(user?.company || '');
        setPhone(user?.phone || user?.phoneNumber || '');
        setJobTitle(user?.jobTitle || '');
        setLocation(user?.location || '');
        setEditing(false);
        clearFeedback();
    }

    async function handleSave(event) {
        event.preventDefault();
        clearFeedback();

        const trimmedName = fullName.trim();

        if (!trimmedName) {
            setError('Please enter your full name.');
            return;
        }

        if (!token) {
            setError('Your session has expired. Please sign in again.');
            return;
        }

        setLoading(true);

        try {
            // These HR-only fields are currently stored in browser session
            // state; this screen does not claim to persist them to the database.
            updateUser({
                fullName: trimmedName,
                company: company.trim(),
                phone: phone.trim(),
                jobTitle: jobTitle.trim(),
                location: location.trim(),
            });

            setEditing(false);

            setMessage(
                'Profile details updated for this browser session. The photo controls below are saved to your account.'
            );
        } catch (saveError) {
            setError(saveError.message || 'Unable to update your profile.');
        } finally {
            setLoading(false);
        }
    }

    function openPhotoPicker() {
        clearFeedback();
        fileInputRef.current?.click();
    }

    function handleFileSelected(event) {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) return;

        if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
            setError('Choose a JPG, PNG, or WebP image.');
            return;
        }

        if (file.size > MAX_IMAGE_BYTES) {
            setError('Choose an image smaller than 2 MB.');
            return;
        }

        if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
        }

        const objectUrl = URL.createObjectURL(file);
        previewUrlRef.current = objectUrl;

        setSelectedFile(file);
        setPreviewUrl(objectUrl);
        setZoom(1);
        setPanX(0);
        setPanY(0);
        setPhotoDialogOpen(true);
        clearFeedback();
    }

    function closePhotoDialog() {
        if (photoBusy) return;

        setPhotoDialogOpen(false);
        setSelectedFile(null);
        setPreviewUrl('');

        if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
        }

        previewUrlRef.current = '';
    }

    async function makeCroppedImage(file, scale, offsetX, offsetY) {
        const imageUrl = URL.createObjectURL(file);

        try {
            const image = new Image();
            image.src = imageUrl;

            await new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = () => {
                    reject(
                        new Error(
                            'Could not read this image. Please choose another one.'
                        )
                    );
                };
            });

            const side =
                Math.min(image.naturalWidth, image.naturalHeight) / scale;

            const maxX = Math.max(
                0,
                (image.naturalWidth - side) / 2
            );

            const maxY = Math.max(
                0,
                (image.naturalHeight - side) / 2
            );

            const sourceX = Math.max(
                0,
                Math.min(
                    image.naturalWidth - side,
                    maxX + offsetX * maxX
                )
            );

            const sourceY = Math.max(
                0,
                Math.min(
                    image.naturalHeight - side,
                    maxY + offsetY * maxY
                )
            );

            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 640;

            const context = canvas.getContext('2d');

            if (!context) {
                throw new Error('Your browser cannot crop this image.');
            }

            context.drawImage(
                image,
                sourceX,
                sourceY,
                side,
                side,
                0,
                0,
                640,
                640
            );

            const blob = await new Promise((resolve) => {
                canvas.toBlob(resolve, 'image/jpeg', 0.9);
            });

            if (!blob) {
                throw new Error(
                    'Could not prepare the image. Please try again.'
                );
            }

            return new File([blob], 'profile-picture.jpg', {
                type: 'image/jpeg',
            });
        } finally {
            URL.revokeObjectURL(imageUrl);
        }
    }

    async function savePhoto() {
        if (!selectedFile || !token) {
            setError(
                !token
                    ? 'Your session has expired. Please sign in again.'
                    : 'Please select a photo first.'
            );
            return;
        }

        setPhotoBusy(true);
        clearFeedback();

        try {
            const croppedFile = await makeCroppedImage(
                selectedFile,
                zoom,
                panX,
                panY
            );

            const formData = new FormData();
            formData.append('file', croppedFile);

            const response = await fetch(
                `${API_URL}/Profile/upload-picture`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    body: formData,
                }
            );

            const data = await readResponse(response);

            updateUser({
                profilePictureUrl: data.profilePictureUrl || null,
            });

            setMessage('Profile photo saved successfully.');
            setPhotoDialogOpen(false);
            setSelectedFile(null);
            setPreviewUrl('');

            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
            }

            previewUrlRef.current = '';
        } catch (uploadError) {
            setError(
                uploadError.message || 'Could not save the profile photo.'
            );
        } finally {
            setPhotoBusy(false);
        }
    }

    // Open the custom confirmation dialog instead of using window.confirm().
    function deletePhoto() {
        if (!profilePictureUrl || photoBusy) return;

        if (!token) {
            setError('Your session has expired. Please sign in again.');
            return;
        }

        clearFeedback();
        setConfirmDeletePhoto(true);
    }

    // The photo is deleted only after the user confirms.
    async function confirmPhotoDeletion() {
        if (!profilePictureUrl || photoBusy || !token) return;

        setPhotoBusy(true);
        clearFeedback();

        try {
            const response = await fetch(`${API_URL}/Profile/picture`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            await readResponse(response);

            updateUser({ profilePictureUrl: null });

            setMessage('Profile photo deleted successfully.');
            setConfirmDeletePhoto(false);
        } catch (deleteError) {
            setError(
                deleteError.message || 'Could not delete the profile photo.'
            );
            setConfirmDeletePhoto(false);
        } finally {
            setPhotoBusy(false);
        }
    }

    function cancelPhotoDeletion() {
        if (photoBusy) return;
        setConfirmDeletePhoto(false);
    }

    if (!user) {
        return (
            <div className="hr-profile">
                <div className="hr-profile-notice">
                    Please sign in to view your profile.
                </div>
            </div>
        );
    }

    return (
        <div className="hr-profile">
            <header className="hr-profile-heading">
                <div>
                    <span className="hr-profile-eyebrow">
                        ACCOUNT SETTINGS
                    </span>
                    <h1>My Profile</h1>
                    <p>
                        Manage your personal and professional information.
                    </p>
                </div>

                {!editing && (
                    <button
                        className="hr-profile-primary"
                        type="button"
                        onClick={() => {
                            clearFeedback();
                            setEditing(true);
                        }}
                    >
                        <span aria-hidden="true">✎</span> Edit Profile
                    </button>
                )}
            </header>

            {message && (
                <div
                    className="hr-profile-alert success"
                    role="status"
                >
                    <span aria-hidden="true">✓</span>
                    <span>{message}</span>
                </div>
            )}

            {error && (
                <div
                    className="hr-profile-alert error"
                    role="alert"
                >
                    <span aria-hidden="true">!</span>
                    <span>{error}</span>
                </div>
            )}

            <section className="hr-profile-hero">
                <div className="hr-profile-photo-column">
                    <div
                        className="hr-profile-avatar"
                        aria-label="Profile photo"
                    >
                        {profilePictureUrl ? (
                            <img
                                src={profilePictureUrl}
                                alt={`${fullName || 'HR'} profile`}
                            />
                        ) : (
                            <span>{getInitials(fullName)}</span>
                        )}
                    </div>

                    <div className="hr-profile-photo-actions">
                        <input
                            ref={fileInputRef}
                            className="hr-profile-file-input"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleFileSelected}
                            aria-label="Choose profile photo"
                        />

                        <button
                            className="hr-profile-photo-edit"
                            type="button"
                            onClick={openPhotoPicker}
                            disabled={photoBusy}
                        >
                            <span aria-hidden="true">✎</span> Edit photo
                        </button>

                        {profilePictureUrl && (
                            <button
                                className="hr-profile-photo-delete"
                                type="button"
                                onClick={deletePhoto}
                                disabled={photoBusy}
                            >
                                {photoBusy ? 'Please wait…' : 'Delete photo'}
                            </button>
                        )}
                    </div>

                    <small className="hr-profile-photo-help">
                        JPG, PNG or WebP · Max 2 MB
                    </small>
                </div>

                <div className="hr-profile-identity">
                    <h2>{fullName || 'HR User'}</h2>
                    <p>{email}</p>

                    <div className="hr-profile-tags">
                        <span className="hr-profile-role">
                            HR / Employer
                        </span>

                        <span className="hr-profile-status">
                            <span className="hr-profile-status-dot" />
                            Signed in
                        </span>
                    </div>
                </div>

                <div className="hr-profile-member">
                    <span>ACCOUNT ROLE</span>
                    <strong>{role}</strong>
                </div>
            </section>

            <form onSubmit={handleSave}>
                <section className="hr-profile-card">
                    <div className="hr-profile-card-heading">
                        <div
                            className="hr-profile-card-icon"
                            aria-hidden="true"
                        >
                            ♙
                        </div>

                        <div>
                            <h3>Personal Information</h3>
                            <p>Your basic account details.</p>
                        </div>
                    </div>

                    <div className="hr-profile-grid">
                        <label className="hr-profile-field">
                            <span>
                                Full Name <b>*</b>
                            </span>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(event) =>
                                    setFullName(event.target.value)
                                }
                                placeholder="Enter your full name"
                                disabled={!editing || loading}
                                required
                                maxLength={100}
                                autoComplete="name"
                            />
                        </label>

                        <label className="hr-profile-field">
                            <span>Email Address</span>
                            <input
                                type="email"
                                value={email}
                                disabled
                                autoComplete="email"
                            />
                            <small>
                                Email is managed by your account.
                            </small>
                        </label>

                        <label className="hr-profile-field">
                            <span>Phone Number</span>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(event) =>
                                    setPhone(event.target.value)
                                }
                                placeholder="Enter your phone number"
                                disabled={!editing || loading}
                                maxLength={25}
                                autoComplete="tel"
                            />
                        </label>

                        <label className="hr-profile-field">
                            <span>Job Title</span>
                            <input
                                type="text"
                                value={jobTitle}
                                onChange={(event) =>
                                    setJobTitle(event.target.value)
                                }
                                placeholder="e.g. Talent Acquisition Manager"
                                disabled={!editing || loading}
                                maxLength={100}
                            />
                        </label>
                    </div>
                </section>

                <section className="hr-profile-card">
                    <div className="hr-profile-card-heading">
                        <div
                            className="hr-profile-card-icon"
                            aria-hidden="true"
                        >
                            ▦
                        </div>

                        <div>
                            <h3>Professional Information</h3>
                            <p>
                                Information about your organization.
                            </p>
                        </div>
                    </div>

                    <div className="hr-profile-grid">
                        <label className="hr-profile-field">
                            <span>Company Name</span>
                            <input
                                type="text"
                                value={company}
                                onChange={(event) =>
                                    setCompany(event.target.value)
                                }
                                placeholder="Enter your company name"
                                disabled={!editing || loading}
                                maxLength={150}
                                autoComplete="organization"
                            />
                        </label>

                        <label className="hr-profile-field">
                            <span>Location</span>
                            <input
                                type="text"
                                value={location}
                                onChange={(event) =>
                                    setLocation(event.target.value)
                                }
                                placeholder="City, State or Country"
                                disabled={!editing || loading}
                                maxLength={150}
                                autoComplete="address-level2"
                            />
                        </label>
                    </div>
                </section>

                {editing && (
                    <div className="hr-profile-actions">
                        <button
                            type="button"
                            className="hr-profile-secondary"
                            onClick={resetForm}
                            disabled={loading}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="hr-profile-primary"
                            disabled={loading}
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                )}
            </form>

            <section className="hr-profile-security">
                <div
                    className="hr-profile-security-icon"
                    aria-hidden="true"
                >
                    ✓
                </div>

                <div>
                    <h3>Account Security</h3>
                    <p>
                        Your account email and role cannot be changed from
                        this screen. Contact your administrator if you need
                        account assistance.
                    </p>
                </div>
            </section>

            {photoDialogOpen && (
                <div
                    className="hr-profile-modal-backdrop"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closePhotoDialog();
                        }
                    }}
                >
                    <section
                        className="hr-profile-photo-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="hr-photo-dialog-title"
                    >
                        <div className="hr-profile-photo-modal-heading">
                            <div>
                                <span className="hr-profile-eyebrow">
                                    PROFILE PHOTO
                                </span>
                                <h2 id="hr-photo-dialog-title">
                                    Adjust your photo
                                </h2>
                                <p>
                                    Move the zoom slider until the square
                                    preview looks right, then save.
                                </p>
                            </div>

                            <button
                                type="button"
                                className="hr-profile-modal-close"
                                onClick={closePhotoDialog}
                                disabled={photoBusy}
                                aria-label="Close photo editor"
                            >
                                ×
                            </button>
                        </div>

                        <div className="hr-profile-crop-preview">
                            <img
                                src={previewUrl}
                                alt="Selected photo preview"
                                style={{
                                    objectPosition: `${50 + panX * 50}% ${50 + panY * 50}%`,
                                    transform: `scale(${zoom})`,
                                }}
                            />
                        </div>

                        <label className="hr-profile-zoom-control">
                            <span>Zoom</span>
                            <input
                                type="range"
                                min="1"
                                max="3"
                                step="0.05"
                                value={zoom}
                                onChange={(event) =>
                                    setZoom(Number(event.target.value))
                                }
                                disabled={photoBusy}
                            />
                            <output>{Math.round(zoom * 100)}%</output>
                        </label>

                        <label className="hr-profile-zoom-control">
                            <span>Horizontal</span>
                            <input
                                type="range"
                                min="-1"
                                max="1"
                                step="0.05"
                                value={panX}
                                onChange={(event) =>
                                    setPanX(Number(event.target.value))
                                }
                                disabled={photoBusy}
                            />
                            <output>
                                {panX < 0
                                    ? 'Left'
                                    : panX > 0
                                        ? 'Right'
                                        : 'Center'}
                            </output>
                        </label>

                        <label className="hr-profile-zoom-control">
                            <span>Vertical</span>
                            <input
                                type="range"
                                min="-1"
                                max="1"
                                step="0.05"
                                value={panY}
                                onChange={(event) =>
                                    setPanY(Number(event.target.value))
                                }
                                disabled={photoBusy}
                            />
                            <output>
                                {panY < 0
                                    ? 'Up'
                                    : panY > 0
                                        ? 'Down'
                                        : 'Center'}
                            </output>
                        </label>

                        <p className="hr-profile-crop-note">
                            Your photo is cropped to a square and saved to
                            your account. For best results, use a clear,
                            front-facing image.
                        </p>

                        <div className="hr-profile-photo-modal-actions">
                            <button
                                type="button"
                                className="hr-profile-secondary"
                                onClick={closePhotoDialog}
                                disabled={photoBusy}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                className="hr-profile-primary"
                                onClick={savePhoto}
                                disabled={photoBusy}
                            >
                                {photoBusy ? 'Saving photo…' : 'Save photo'}
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {/* Custom confirmation dialog for profile photo deletion. */}
            <ConfirmDialog
                open={confirmDeletePhoto}
                title="Delete profile photo?"
                message="Are you sure you want to delete your current profile photo? This action cannot be undone."
                confirmText="Delete Photo"
                cancelText="Keep Photo"
                danger={true}
                loading={photoBusy}
                onConfirm={confirmPhotoDeletion}
                onCancel={cancelPhotoDeletion}
            />
        </div>
    );
}
