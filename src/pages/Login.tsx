import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { BackgroundDecor } from '@/components/layout/BackgroundDecor';

const signInSchema = z.object({
  email: z.string().trim().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type SignInFormData = z.infer<typeof signInSchema>;

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, user, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user && profile) {
      navigate(profile.profile_completed ? '/home' : '/profile-setup');
    }
  }, [user, profile, navigate]);

  const form = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const handleSignIn = async (data: SignInFormData) => {
    setIsLoading(true);
    const { error } = await signIn(data.email, data.password);
    setIsLoading(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Sign in failed',
        description: error.message === 'Invalid login credentials'
          ? 'Invalid email or password. Please try again.'
          : error.message,
      });
    } else {
      toast({ title: 'Welcome back!' });
      navigate('/home');
    }
  };

  return (
    <BackgroundDecor>
      <div className="container mx-auto flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <div className="glass-card rounded-2xl p-8 shadow-soft-lg">
            <div className="mb-8 text-center">
              <h1 className="font-display text-4xl text-foreground">WELCOME BACK</h1>
              <p className="mt-2 text-muted-foreground">Sign in to access your account</p>
            </div>

            <form onSubmit={form.handleSubmit(handleSignIn)} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" {...form.register('email')} className="mt-1.5" />
                {form.formState.errors.email && (
                  <p className="mt-1 text-sm text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative mt-1.5">
                  <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" {...form.register('password')} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {form.formState.errors.password && (
                  <p className="mt-1 text-sm text-destructive">{form.formState.errors.password.message}</p>
                )}
              </div>

              <Button type="submit" variant="hero" className="mt-6 w-full" size="lg" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Login'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link to="/signup" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Don't have an account? Sign Up
              </Link>
            </div>
          </div>
        </div>
      </div>
    </BackgroundDecor>
  );
}
