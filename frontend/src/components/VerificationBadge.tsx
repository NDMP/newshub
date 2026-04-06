// frontend/src/components/VerificationBadge.tsx
import React, { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface VerificationBadgeProps {
    score: number;
    size?: 'small' | 'medium' | 'large';
    showDetails?: boolean;
    articleId: number;
}

const VerificationBadge: React.FC<VerificationBadgeProps> = ({ 
    score, 
    size = 'medium', 
    showDetails = false,
    articleId 
}) => {
    const [details, setDetails] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [showPopup, setShowPopup] = useState(false);

    const getBadgeInfo = () => {
        if (score >= 80) {
            return {
                level: 'Verified',
                color: '#10b981',
                bg: 'rgba(16, 185, 129, 0.1)',
                icon: CheckCircle,
                text: 'High Credibility'
            };
        } else if (score >= 60) {
            return {
                level: 'Trustworthy',
                color: '#3b82f6',
                bg: 'rgba(59, 130, 246, 0.1)',
                icon: Shield,
                text: 'Good Credibility'
            };
        } else if (score >= 40) {
            return {
                level: 'Mixed',
                color: '#f59e0b',
                bg: 'rgba(245, 158, 11, 0.1)',
                icon: Info,
                text: 'Medium Credibility'
            };
        } else {
            return {
                level: 'Caution',
                color: '#ef4444',
                bg: 'rgba(239, 68, 68, 0.1)',
                icon: AlertTriangle,
                text: 'Low Credibility'
            };
        }
    };

    const badge = getBadgeInfo();
    const Icon = badge.icon;

    const fetchDetails = async () => {
        if (details) {
            setShowPopup(!showPopup);
            return;
        }
        
        setLoading(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const response = await fetch(`${apiUrl}/api/user/verification/${articleId}`);
            const data = await response.json();
            setDetails(data);
            setShowPopup(true);
        } catch (error) {
            console.error('Failed to fetch verification details:', error);
        } finally {
            setLoading(false);
        }
    };

    const sizeStyles = {
        small: { padding: '2px 6px', fontSize: '10px', gap: '4px' },
        medium: { padding: '4px 10px', fontSize: '12px', gap: '6px' },
        large: { padding: '6px 14px', fontSize: '14px', gap: '8px' }
    };

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <div
                onClick={fetchDetails}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: sizeStyles[size].gap,
                    padding: sizeStyles[size].padding,
                    backgroundColor: badge.bg,
                    border: `1px solid ${badge.color}30`,
                    borderRadius: '20px',
                    color: badge.color,
                    fontSize: sizeStyles[size].fontSize,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                }}
            >
                <Icon size={size === 'small' ? 12 : size === 'medium' ? 14 : 16} />
                <span>{badge.level}</span>
                <span style={{ opacity: 0.7 }}>({score}%)</span>
            </div>

            {showPopup && details && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '8px',
                    width: '300px',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '16px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                    zIndex: 1000
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
                            Verification Details
                        </h4>
                        <button
                            onClick={() => setShowPopup(false)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                            ✕
                        </button>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                            Trust Score: {details.score}%
                        </div>
                        <div style={{
                            height: '6px',
                            backgroundColor: 'var(--border)',
                            borderRadius: '3px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: `${details.score}%`,
                                height: '100%',
                                backgroundColor: badge.color,
                                borderRadius: '3px'
                            }} />
                        </div>
                    </div>

                    {details.verified_claims?.length > 0 && (
                        <div style={{ marginBottom: '10px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', marginBottom: '4px' }}>
                                ✓ Verified Claims
                            </div>
                            {details.verified_claims.map((claim: any, i: number) => (
                                <div key={i} style={{ fontSize: '12px', marginBottom: '2px' }}>
                                    • {claim.claim}
                                </div>
                            ))}
                        </div>
                    )}

                    {details.disputed_claims?.length > 0 && (
                        <div style={{ marginBottom: '10px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', marginBottom: '4px' }}>
                                ⚠️ Needs Verification
                            </div>
                            {details.disputed_claims.map((claim: any, i: number) => (
                                <div key={i} style={{ fontSize: '12px', marginBottom: '2px' }}>
                                    • {claim.claim}
                                </div>
                            ))}
                        </div>
                    )}

                    {details.conflicting_sources?.length > 0 && (
                        <div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', marginBottom: '4px' }}>
                                ❌ Conflicting Sources
                            </div>
                            {details.conflicting_sources.map((source: string, i: number) => (
                                <div key={i} style={{ fontSize: '12px', marginBottom: '2px' }}>
                                    • {source}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default VerificationBadge;