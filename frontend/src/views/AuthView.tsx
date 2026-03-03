import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

interface AuthViewProps {
    onAuthSuccess: (user: { email: string }) => void;
    onBack: () => void;
}

const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess, onBack }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            if (isLogin) {
                const { data, error: authError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (authError) throw authError;
                if (data.user) onAuthSuccess({ email: data.user.email! });
            } else {
                const { data, error: authError } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (authError) throw authError;
                if (data.user) onAuthSuccess({ email: data.user.email! });
            }
        } catch (err: any) {
            setError(err.message || 'Authentication failed');
        }
    };

    return (
        <div className="auth-overlay">
            <div className="auth-card">
                <button className="back-btn" onClick={onBack}>×</button>
                <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
                <p className="auth-subtitle">{isLogin ? 'Sign in to access your newsroom' : 'Join the elite news collective'}</p>

                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            placeholder="name@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="auth-submit">
                        {isLogin ? 'Sign In' : 'Sign Up'}
                    </button>
                </form>

                <p className="auth-toggle">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}
                    <button onClick={() => setIsLogin(!isLogin)}>
                        {isLogin ? 'Create one' : 'Login'}
                    </button>
                </p>
            </div>
        </div>
    );
};

export default AuthView;
