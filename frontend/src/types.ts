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
}
