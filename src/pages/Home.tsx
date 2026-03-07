import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { CATEGORIES } from '@/types/database';
import categoryDresses from '@/assets/category-dresses.jpg';
import categorySuits from '@/assets/category-suits.jpg';
import categoryStreetwear from '@/assets/category-streetwear.jpg';
import categoryFormal from '@/assets/category-formal.jpg';
import categoryCasual from '@/assets/category-casual.jpg';
import categoryAccessories from '@/assets/category-accessories.jpg';
import categoryShoes from '@/assets/category-shoes.jpg';
import categoryOuterwear from '@/assets/category-outerwear.jpg';
import categoryVintage from '@/assets/category-vintage.jpg';
import categoryDesigner from '@/assets/category-designer.jpg';

const categoryImages: Record<string, string> = {
  dresses: categoryDresses,
  suits: categorySuits,
  streetwear: categoryStreetwear,
  formal: categoryFormal,
  casual: categoryCasual,
  accessories: categoryAccessories,
  shoes: categoryShoes,
  outerwear: categoryOuterwear,
  vintage: categoryVintage,
  designer: categoryDesigner,
};

export default function Home() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Browse Fits Section */}
        <div className="mb-12">
          <h1 className="font-display text-5xl text-foreground">BROWSE FITS</h1>
          <p className="mt-4 text-muted-foreground">Find the perfect fit for any occasion</p>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {CATEGORIES.map((category, index) => (
            <Link
              key={category.value}
              to={`/browse?category=${category.value}`}
              className="group relative aspect-square overflow-hidden rounded-2xl shadow-card transition-all duration-300 hover:shadow-card-hover"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <img
                src={categoryImages[category.value]}
                alt={category.label}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20 transition-opacity group-hover:from-black/90" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-display text-2xl text-background md:text-3xl">
                  {category.label.toUpperCase()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
