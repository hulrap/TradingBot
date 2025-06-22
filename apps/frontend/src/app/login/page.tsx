'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../../context/AuthContext';
import { 
  Eye, 
  EyeOff, 
  Shield, 
  Lock, 
  Mail, 
  AlertCircle, 
  CheckCircle, 
  Bot,
  ArrowRight,
  Globe,
  Zap,
  TrendingUp
} from 'lucide-react';

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
  requirements: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
}

interface SecurityFeature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const SECURITY_FEATURES: SecurityFeature[] = [
  {
    icon: <Shield className="h-5 w-5 text-green-400" />,
    title: "Bank-Grade Security",
    description: "End-to-end encryption and multi-layer security protocols"
  },
  {
    icon: <Globe className="h-5 w-5 text-blue-400" />,
    title: "Global Infrastructure", 
    description: "Distributed systems across multiple regions for reliability"
  },
  {
    icon: <Zap className="h-5 w-5 text-yellow-400" />,
    title: "Real-Time Trading",
    description: "Sub-millisecond execution times with premium connections"
  }
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);

  // Check password strength
  const checkPasswordStrength = (pwd: string): PasswordStrength => {
    const requirements = {
      length: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /\d/.test(pwd),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd)
    };

    const score = Object.values(requirements).filter(Boolean).length;
    
    let label = 'Very Weak';
    let color = 'red';
    
    if (score >= 5) {
      label = 'Very Strong';
      color = 'green';
    } else if (score >= 4) {
      label = 'Strong';
      color = 'blue';
    } else if (score >= 3) {
      label = 'Medium';
      color = 'yellow';
    } else if (score >= 2) {
      label = 'Weak';
      color = 'orange';
    }

    return { score, label, color, requirements };
  };

  const passwordStrength = checkPasswordStrength(password);

  // Enhanced email validation
  const validateEmail = (email: string): { isValid: boolean; message?: string } => {
    if (!email.trim()) {
      return { isValid: false, message: 'Email is required' };
    }
    
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!emailRegex.test(email)) {
      return { isValid: false, message: 'Please enter a valid email address' };
    }
    
    if (email.length > 254) {
      return { isValid: false, message: 'Email address is too long' };
    }
    
    return { isValid: true };
  };

  // Enhanced password validation
  const validatePassword = (pwd: string): { isValid: boolean; message?: string } => {
    if (!pwd.trim()) {
      return { isValid: false, message: 'Password is required' };
    }
    
    if (pwd.length < 8) {
      return { isValid: false, message: 'Password must be at least 8 characters long' };
    }
    
    if (pwd.length > 128) {
      return { isValid: false, message: 'Password is too long' };
    }
    
    if (passwordStrength.score < 3) {
      return { isValid: false, message: 'Password is too weak. Please include uppercase, lowercase, numbers, and special characters.' };
    }
    
    return { isValid: true };
  };

  const validateForm = (): boolean => {
    const emailValidation = validateEmail(email);
    const passwordValidation = validatePassword(password);
    
    if (!emailValidation.isValid) {
      setError(emailValidation.message || 'Invalid email');
      return false;
    }
    
    if (!passwordValidation.isValid) {
      setError(passwordValidation.message || 'Invalid password');
      return false;
    }
    
    return true;
  };

  // Rate limiting check
  useEffect(() => {
    if (loginAttempts >= 5) {
      setIsRateLimited(true);
      const timer = setTimeout(() => {
        setIsRateLimited(false);
        setLoginAttempts(0);
      }, 300000); // 5 minutes

      return () => clearTimeout(timer);
    }
  }, [loginAttempts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isRateLimited) {
      setError('Too many login attempts. Please wait 5 minutes before trying again.');
      return;
    }

    if (!validateForm()) {
      setLoginAttempts(prev => prev + 1);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await login(email.trim(), password);
      
      if (result.success) {
        setShowSuccess(true);
        setLoginAttempts(0);
        
        // Show success message briefly before redirect
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      } else {
        setError(result.message || 'Login failed. Please check your credentials and try again.');
        setLoginAttempts(prev => prev + 1);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError('Network error. Please check your connection and try again.');
      setLoginAttempts(prev => prev + 1);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  // Loading state for authenticated users
  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Already authenticated, redirecting...</p>
        </div>
      </div>
    );
  }

  // Success state
  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <Card className="w-full max-w-md bg-gray-800/90 border-green-500/50">
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Login Successful!</h2>
            <p className="text-gray-300 mb-4">Welcome back to TradingBot Pro</p>
            <div className="animate-pulse text-blue-400">Redirecting to dashboard...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const emailValidation = validateEmail(email);
  const passwordValidation = validatePassword(password);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <nav className="border-b border-gray-800/50 backdrop-blur-sm bg-gray-900/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Bot className="h-8 w-8 text-blue-400" />
              <span className="text-xl font-bold">TradingBot Pro</span>
            </div>
            <div className="flex items-center gap-4">
              <Button
                onClick={() => router.push('/')}
                variant="ghost"
                className="text-gray-300 hover:text-white"
              >
                Back to Home
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Features */}
          <div className="space-y-8">
            <div>
              <Badge variant="outline" className="mb-4 bg-blue-900/50 border-blue-500/50 text-blue-300">
                Enterprise Trading Platform
              </Badge>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Secure Access to
                <br />
                <span className="text-blue-400">Professional Trading</span>
              </h1>
              <p className="text-xl text-gray-300 leading-relaxed">
                Access your institutional-grade trading dashboard with bank-level security 
                and enterprise authentication protocols.
              </p>
            </div>

            <div className="space-y-6">
              {SECURITY_FEATURES.map((feature, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="flex-shrink-0 p-2 bg-gray-800/50 rounded-lg">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
                    <p className="text-gray-400 text-sm">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-6 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <span>99.9% Uptime</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-400" />
                <span>SOC 2 Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-purple-400" />
                <span>256-bit Encryption</span>
              </div>
            </div>
          </div>

          {/* Right side - Login Form */}
          <div className="w-full max-w-md mx-auto">
            <Card className="bg-gray-800/90 border-gray-700/50 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-center text-white">
                  Sign In to Your Account
                </CardTitle>
                <p className="text-center text-gray-400">
                  Enter your credentials to access your trading dashboard
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
                  {/* Email Field */}
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium text-gray-300">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={() => setEmailTouched(true)}
                        className={`w-full pl-10 pr-4 py-3 bg-gray-700/50 rounded-lg border transition-colors
                          ${emailTouched && !emailValidation.isValid 
                            ? 'border-red-500 focus:ring-red-500' 
                            : emailTouched && emailValidation.isValid
                            ? 'border-green-500 focus:ring-green-500'
                            : 'border-gray-600 focus:ring-blue-500'
                          }
                          focus:outline-none focus:ring-2 text-white placeholder-gray-400`}
                        placeholder="Enter your email"
                        required
                        disabled={isSubmitting}
                        autoComplete="email"
                        aria-describedby={error ? "error-message" : undefined}
                      />
                      {emailTouched && emailValidation.isValid && (
                        <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-400" />
                      )}
                    </div>
                    {emailTouched && !emailValidation.isValid && (
                      <p className="text-red-400 text-xs flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {emailValidation.message}
                      </p>
                    )}
                  </div>

                  {/* Password Field */}
                  <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium text-gray-300">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onBlur={() => setPasswordTouched(true)}
                        className={`w-full pl-10 pr-12 py-3 bg-gray-700/50 rounded-lg border transition-colors
                          ${passwordTouched && !passwordValidation.isValid 
                            ? 'border-red-500 focus:ring-red-500' 
                            : passwordTouched && passwordValidation.isValid
                            ? 'border-green-500 focus:ring-green-500'
                            : 'border-gray-600 focus:ring-blue-500'
                          }
                          focus:outline-none focus:ring-2 text-white placeholder-gray-400`}
                        placeholder="Enter your password"
                        required
                        disabled={isSubmitting}
                        autoComplete="current-password"
                        aria-describedby={error ? "error-message" : undefined}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                        disabled={isSubmitting}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>

                    {/* Password Strength Indicator */}
                    {password && passwordTouched && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">Password Strength:</span>
                          <span className={`text-xs font-medium ${
                            passwordStrength.color === 'green' ? 'text-green-400' :
                            passwordStrength.color === 'blue' ? 'text-blue-400' :
                            passwordStrength.color === 'yellow' ? 'text-yellow-400' :
                            passwordStrength.color === 'orange' ? 'text-orange-400' :
                            'text-red-400'
                          }`}>
                            {passwordStrength.label}
                          </span>
                        </div>
                        <div className="grid grid-cols-5 gap-1">
                          {Array.from({ length: 5 }, (_, i) => (
                            <div
                              key={i}
                              className={`h-1 rounded-full ${
                                i < passwordStrength.score 
                                  ? passwordStrength.color === 'green' ? 'bg-green-400' :
                                    passwordStrength.color === 'blue' ? 'bg-blue-400' :
                                    passwordStrength.color === 'yellow' ? 'bg-yellow-400' :
                                    passwordStrength.color === 'orange' ? 'bg-orange-400' :
                                    'bg-red-400'
                                  : 'bg-gray-600'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {passwordTouched && !passwordValidation.isValid && (
                      <p className="text-red-400 text-xs flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {passwordValidation.message}
                      </p>
                    )}
                  </div>

                  {/* Remember Me & Rate Limit Warning */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                          disabled={isSubmitting}
                        />
                        <span className="text-sm text-gray-300">Remember me</span>
                      </label>
                      <button
                        type="button"
                        className="text-sm text-blue-400 hover:text-blue-300"
                        disabled={isSubmitting}
                      >
                        Forgot password?
                      </button>
                    </div>

                    {loginAttempts > 0 && (
                      <div className={`text-xs p-2 rounded-lg ${
                        isRateLimited ? 'bg-red-900/50 text-red-300' : 'bg-yellow-900/50 text-yellow-300'
                      }`}>
                        {isRateLimited 
                          ? '⚠️ Account temporarily locked due to multiple failed attempts'
                          : `⚠️ ${loginAttempts}/5 failed attempts. Account will be locked after 5 failures.`
                        }
                      </div>
                    )}
                  </div>

                  {/* Error Display */}
                  {error && (
                    <div id="error-message" className="p-3 bg-red-900/50 border border-red-500/50 rounded-lg">
                      <p className="text-red-200 text-sm flex items-center gap-2" role="alert">
                        <AlertCircle className="h-4 w-4" />
                        {error}
                      </p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isSubmitting || isRateLimited}
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Signing In...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        Sign In to Dashboard
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    )}
                  </Button>
                </form>

                {/* Footer */}
                <div className="text-center space-y-3">
                  <div className="text-xs text-gray-500">
                    Protected by enterprise-grade security
                  </div>
                  <div className="flex justify-center gap-4 text-xs text-gray-500">
                    <span>Terms of Service</span>
                    <span>•</span>
                    <span>Privacy Policy</span>
                    <span>•</span>
                    <span>Security</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
} 