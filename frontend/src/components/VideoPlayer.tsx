// frontend/src/components/VideoPlayer.tsx
import { useState } from 'react';
import { Play, X, Maximize2, Minimize2 } from 'lucide-react';

interface VideoPlayerProps {
    videoId: string;
    title: string;
    thumbnail?: string;
    autoPlay?: boolean;
    onClose?: () => void;
}

export default function VideoPlayer({ videoId, title, thumbnail, autoPlay = false, onClose }: VideoPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [isExpanded, setIsExpanded] = useState(false);

    if (isPlaying) {
        return (
            <div className={`video-player ${isExpanded ? 'expanded' : ''}`} style={{
                position: 'relative',
                width: '100%',
                borderRadius: '12px',
                overflow: 'hidden',
                backgroundColor: '#000',
                marginBottom: '16px'
            }}>
                <div style={{
                    position: 'relative',
                    paddingBottom: '56.25%', // 16:9 aspect ratio
                    height: 0
                }}>
                    <iframe
                        src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                        title={title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%'
                        }}
                    />
                </div>
                
                {/* Controls overlay */}
                <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    display: 'flex',
                    gap: '8px',
                    zIndex: 10
                }}>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        style={{
                            background: 'rgba(0,0,0,0.7)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'white'
                        }}
                    >
                        {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                    
                    {onClose && (
                        <button
                            onClick={onClose}
                            style={{
                                background: 'rgba(0,0,0,0.7)',
                                border: 'none',
                                borderRadius: '50%',
                                width: '36px',
                                height: '36px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: 'white'
                            }}
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div 
            className="video-thumbnail"
            onClick={() => setIsPlaying(true)}
            style={{
                position: 'relative',
                width: '100%',
                borderRadius: '12px',
                overflow: 'hidden',
                cursor: 'pointer',
                marginBottom: '16px',
                backgroundImage: `url(${thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                paddingBottom: '56.25%', // 16:9 aspect ratio
                backgroundColor: '#1a1a1a'
            }}
        >
            {/* Play button overlay */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '60px',
                height: '60px',
                backgroundColor: 'rgba(255,0,0,0.8)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s ease'
            }}>
                <Play size={30} fill="white" color="white" />
            </div>

            {/* Video title overlay */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '20px 16px 12px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                color: 'white',
                fontSize: '14px',
                fontWeight: 600
            }}>
                {title.length > 60 ? title.substring(0, 60) + '...' : title}
            </div>
        </div>
    );
}