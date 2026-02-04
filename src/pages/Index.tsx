import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/layout/Layout';
import { ArrowRight, Sparkles, Shield, RefreshCw } from 'lucide-react';
import heroImage from '@/assets/hero-fashion.jpg';
import { CATEGORIES } from '@/types/database';

export default function Index() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative min-h-[90vh] overflow-hidden bg-hero-gradient">
        <div className="container relative z-10 mx-auto flex min-h-[90vh] items-center px-4 py-20">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <div className="flex flex-col justify-center">
              <div className="mb-6 inline-flex">
                <span className="rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                  Peer-to-Peer Fashion Rentals
                </span>
              </div>
              
              <h1 className="font-display text-6xl leading-none tracking-tight text-foreground md:text-7xl lg:text-8xl">
                RENT THE
                <br />
                <span className="text-gradient">DRIP</span>
              </h1>
              
              <p className="mt-6 max-w-lg text-lg text-muted-foreground">
                Share your closet. Access any style. The sustainable way to wear designer fits without the designer price tag.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Button variant="hero" size="xl" asChild>
                  <Link to="/browse">
                    Start Browsing
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button variant="hero-outline" size="xl" asChild>
                  <Link to="/upload">List Your Fit</Link>
                </Button>
              </div>

              <div className="mt-12 flex items-center gap-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <span>Verified Users</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <span>Quality Guaranteed</span>
                </div>
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-primary" />
                  <span>Sustainable Fashion</span>
                </div>
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="absolute -right-20 -top-20 h-[600px] w-[500px] rounded-3xl bg-primary/5" />
              <img
                src={heroImage}
                alt="Fashion model in designer streetwear"
                className="relative z-10 h-[600px] w-full rounded-3xl object-cover shadow-xl"
              />
            </div>
          </div>
        </div>

        {/* Abstract shapes */}
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/5" />
        <div className="absolute -right-20 top-1/2 h-60 w-60 rounded-full bg-drip-sage/10" />
      </section>

      {/* Categories Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="font-display text-5xl text-foreground">BROWSE BY CATEGORY</h2>
            <p className="mt-4 text-muted-foreground">Find the perfect fit for any occasion</p>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {CATEGORIES.map((category, index) => (
              <Link
                key={category.value}
                to={`/browse?category=${category.value}`}
                className="group relative aspect-square overflow-hidden rounded-2xl bg-card shadow-card transition-all duration-300 hover:shadow-card-hover"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 to-foreground/20 transition-opacity group-hover:opacity-90" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-display text-2xl text-background md:text-3xl">
                    {category.label.toUpperCase()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-card py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="font-display text-5xl text-foreground">HOW IT WORKS</h2>
            <p className="mt-4 text-muted-foreground">Renting fashion has never been easier</p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Browse & Discover',
                description: 'Explore thousands of fits from verified users. Filter by size, style, and budget.',
              },
              {
                step: '02',
                title: 'Book & Pay',
                description: 'Select your rental dates and pay securely. Deposits protect both parties.',
              },
              {
                step: '03',
                title: 'Wear & Return',
                description: 'Rock your fit, then return it. Leave a review and help the community.',
              },
            ].map((item, index) => (
              <div
                key={item.step}
                className="group rounded-2xl bg-background p-8 shadow-card transition-all duration-300 hover:shadow-card-hover"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <span className="font-display text-6xl text-primary/20 transition-colors group-hover:text-primary/40">
                  {item.step}
                </span>
                <h3 className="mt-4 font-display text-2xl text-foreground">{item.title}</h3>
                <p className="mt-2 text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden py-24">
        <div className="absolute inset-0 bg-terracotta-gradient opacity-95" />
        <div className="container relative z-10 mx-auto px-4 text-center">
          <h2 className="font-display text-5xl text-background md:text-6xl">
            READY TO SHARE YOUR STYLE?
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-background/80">
            Join thousands of fashion lovers who are renting, sharing, and reducing waste. 
            List your first fit today and start earning.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Button 
              size="xl" 
              className="bg-background text-foreground hover:bg-background/90"
              asChild
            >
              <Link to="/auth?mode=signup">
                Create Account
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
