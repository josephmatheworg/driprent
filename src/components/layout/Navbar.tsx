import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, Heart, Package, LogOut, Bell, Menu, X, Pencil } from 'lucide-react';

export function Navbar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to={user ? "/home" : "/"} className="flex items-center gap-2">
          <span className="font-display text-2xl tracking-wide text-foreground sm:text-3xl">DRIP RENT</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-8 md:flex">
          <Link
            to="/browse"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Browse Fits
          </Link>
          <Link
            to="/how-it-works"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            How It Works
          </Link>
        </div>

        {/* Desktop right side */}
        <div className="hidden items-center gap-4 md:flex">
          {user ? (
            <>
              <Button variant="ghost" size="icon" asChild>
                <Link to="/notifications">
                  <Bell className="h-5 w-5" />
                </Link>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={profile?.avatar_url || ''} alt={profile?.username} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {profile?.username?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <div className="flex items-center gap-2 p-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url || ''} />
                      <AvatarFallback>{profile?.username?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{profile?.username}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex cursor-pointer items-center">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/edit-profile" className="flex cursor-pointer items-center">
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/my-fits" className="flex cursor-pointer items-center">
                      <Heart className="mr-2 h-4 w-4" />
                      My Fits
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/rentals" className="flex cursor-pointer items-center">
                      <Package className="mr-2 h-4 w-4" />
                      Rentals
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/login">Sign In</Link>
              </Button>
              <Button variant="hero" asChild>
                <Link to="/signup">Get Started</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          {user && (
            <Button variant="ghost" size="icon" asChild>
              <Link to="/notifications">
                <Bell className="h-5 w-5" />
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-border bg-background px-4 pb-4 pt-2 md:hidden animate-fade-up">
          <div className="flex flex-col gap-1">
            <Link
              to="/browse"
              onClick={closeMobile}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Browse Fits
            </Link>
            <Link
              to="/how-it-works"
              onClick={closeMobile}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              How It Works
            </Link>

            {user ? (
              <>
                <div className="my-2 border-t border-border" />
                <div className="flex items-center gap-3 px-3 py-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.avatar_url || ''} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {profile?.username?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{profile?.username}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <Link to="/profile" onClick={closeMobile} className="rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-accent flex items-center gap-2">
                  <User className="h-4 w-4" /> Profile
                </Link>
                <Link to="/edit-profile" onClick={closeMobile} className="rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-accent flex items-center gap-2">
                  <Pencil className="h-4 w-4" /> Edit Profile
                </Link>
                <Link to="/my-fits" onClick={closeMobile} className="rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-accent flex items-center gap-2">
                  <Heart className="h-4 w-4" /> My Fits
                </Link>
                <Link to="/rentals" onClick={closeMobile} className="rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-accent flex items-center gap-2">
                  <Package className="h-4 w-4" /> Rentals
                </Link>
                <div className="my-2 border-t border-border" />
                <button
                  onClick={() => { closeMobile(); handleSignOut(); }}
                  className="rounded-lg px-3 py-2.5 text-sm text-destructive hover:bg-accent flex items-center gap-2 w-full text-left"
                >
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </>
            ) : (
              <>
                <div className="my-2 border-t border-border" />
                <div className="flex flex-col gap-2 px-3">
                  <Button variant="ghost" asChild className="w-full justify-center" onClick={closeMobile}>
                    <Link to="/login">Sign In</Link>
                  </Button>
                  <Button variant="hero" asChild className="w-full justify-center" onClick={closeMobile}>
                    <Link to="/signup">Get Started</Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
