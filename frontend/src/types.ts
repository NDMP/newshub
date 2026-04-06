// frontend/src/types.ts
export interface Article {
    id: number;
    title: string;
    source: string;
    date: string;
    timestamp: string;
    content: string;
    summary: string;
    sentiment_label: string;
    sentiment_score: number;
    bias_label: string;
    bias_score: number;
    bias_breakdown: string;
    reliability_score: number;
    category: string;
    image_url: string;
    url: string;
    language: string;
    propaganda_techniques: PropagandaTechnique[] | null;
    hasVideo?: boolean;
    verification_score?: number;
    view_count?: number;
    save_count?: number;
}

export interface PropagandaTechnique {
    name: string;
    confidence: number;
    example: string;
}

export interface NarrativeThread {
    id: number;
    title: string;
    topic_keywords: string[];
    first_seen: string;
    last_seen: string;
    article_ids: number[];
    summary: string;
    alert: NarrativeAlert | null;
    created_at: string;
    article_count?: number;
}

export interface NarrativeAlert {
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
    triggered_at: string;
}

export interface Contradiction {
    id: number;
    thread_id: number;
    claim: string;
    article_id_1: number;
    article_id_2: number;
    explanation: string;
    created_at: string;
}

export interface ArticleClaim {
    id: number;
    article_id: number;
    claim: string;
    confidence: number;
    language: string;
}


interface NewsImageGeneratorProps {
    title: string;
    summary: string;
    category: string;
    content?: string;
    imageUrl?: string; // Add this line
}