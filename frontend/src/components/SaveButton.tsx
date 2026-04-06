// frontend/src/components/SaveButton.tsx
import React, { useState } from 'react';
import { Bookmark, BookmarkCheck, FolderPlus } from 'lucide-react';

interface SaveButtonProps {
    articleId: number;
    userId: string;
    onSave?: () => void;
}

const SaveButton: React.FC<SaveButtonProps> = ({ articleId, userId, onSave }) => {
    const [isSaved, setIsSaved] = useState(false);
    const [showCollections, setShowCollections] = useState(false);
    const [collections, setCollections] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const checkIfSaved = async () => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const response = await fetch(`${apiUrl}/api/user/saved/${userId}`);
            const data = await response.json();
            const saved = data.saved?.some((s: any) => s.article_id === articleId);
            setIsSaved(saved);
        } catch (error) {
            console.error('Failed to check saved status:', error);
        }
    };

    React.useEffect(() => {
        if (userId) {
            checkIfSaved();
        }
    }, [userId, articleId]);

    const handleSave = async (e: React.MouseEvent) => {
        e.stopPropagation(); // ← CRITICAL FIX
        e.preventDefault();   // ← Extra safety
        setLoading(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const response = await fetch(`${apiUrl}/api/user/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    articleId,
                    tags: []
                })
            });
            
            if (response.ok) {
                setIsSaved(true);
                if (onSave) onSave();
            }
        } catch (error) {
            console.error('Failed to save article:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUnsave = async (e: React.MouseEvent) => {
        e.stopPropagation(); // ← CRITICAL FIX
        e.preventDefault();   // ← Extra safety
        setLoading(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            await fetch(`${apiUrl}/api/user/save/${userId}/${articleId}`, {
                method: 'DELETE'
            });
            
            setIsSaved(false);
            if (onSave) onSave();
        } catch (error) {
            console.error('Failed to unsave article:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCollections = async (e: React.MouseEvent) => {
        e.stopPropagation(); // ← CRITICAL FIX
        e.preventDefault();   // ← Extra safety
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const response = await fetch(`${apiUrl}/api/user/collections/${userId}`);
            const data = await response.json();
            setCollections(data.collections || []);
            setShowCollections(!showCollections);
        } catch (error) {
            console.error('Failed to fetch collections:', error);
        }
    };

    return (
        <div onClick={(e) => e.stopPropagation()}> {/* ← CRITICAL FIX */}
            <div style={{ display: 'flex', gap: '4px' }}>
                <button
                    onClick={handleSave}
                    disabled={loading}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        backgroundColor: isSaved ? 'rgba(79, 124, 255, 0.1)' : 'transparent',
                        border: `1px solid ${isSaved ? 'var(--accent-blue)' : 'var(--border)'}`,
                        borderRadius: '20px',
                        color: isSaved ? 'var(--accent-blue)' : 'var(--text-muted)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    {isSaved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                    {isSaved ? 'Saved' : 'Save'}
                </button>

                <button
                    onClick={fetchCollections}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        backgroundColor: 'transparent',
                        border: '1px solid var(--border)',
                        borderRadius: '20px',
                        color: 'var(--text-muted)',
                        cursor: 'pointer'
                    }}
                >
                    <FolderPlus size={14} />
                </button>
            </div>

            {showCollections && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    width: '200px',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '8px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                    zIndex: 1000
                }}>
                    <div style={{ padding: '8px', fontWeight: 600, fontSize: '12px' }}>
                        Save to Collection
                    </div>
                    {collections.map((collection: any) => (
                        <button
                            key={collection.id}
                            onClick={(e) => {
                                e.stopPropagation(); // ← CRITICAL FIX
                                e.preventDefault();   // ← Extra safety
                                console.log('Add to collection:', collection.id, articleId);
                                setShowCollections(false);
                            }}
                            style={{
                                width: '100%',
                                padding: '8px',
                                textAlign: 'left',
                                background: 'none',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            📁 {collection.name}
                        </button>
                    ))}
                    <button
                        onClick={(e) => {
                            e.stopPropagation(); // ← CRITICAL FIX
                            e.preventDefault();   // ← Extra safety
                            console.log('Create new collection');
                            setShowCollections(false);
                        }}
                        style={{
                            width: '100%',
                            padding: '8px',
                            textAlign: 'left',
                            background: 'none',
                            border: 'none',
                            borderTop: '1px solid var(--border)',
                            marginTop: '4px',
                            color: 'var(--accent-blue)',
                            fontSize: '12px',
                            cursor: 'pointer'
                        }}
                    >
                        + New Collection
                    </button>
                </div>
            )}
        </div>
    );
};

export default SaveButton;