import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <span className="font-display text-2xl tracking-wide">DRIP RENT</span>
            <p className="mt-4 text-sm text-muted-foreground">
              The peer-to-peer fashion rental platform. Rent fits, share style, reduce waste.
            </p>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">Explore</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/browse" className="transition-colors hover:text-foreground">
                  Browse Fits
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" className="transition-colors hover:text-foreground">
                  How It Works
                </Link>
              </li>
              <li>
                <Link to="/upload" className="transition-colors hover:text-foreground">
                  List Your Fit
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">Support</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/help" className="transition-colors hover:text-foreground">
                  Help Center
                </Link>
              </li>
              <li>
                <Link to="/safety" className="transition-colors hover:text-foreground">
                  Safety Guidelines
                </Link>
              </li>
              <li>
                <Link to="/contact" className="transition-colors hover:text-foreground">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/terms" className="transition-colors hover:text-foreground">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="transition-colors hover:text-foreground">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/rental-agreement" className="transition-colors hover:text-foreground">
                  Rental Agreement
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Drip Rent. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
