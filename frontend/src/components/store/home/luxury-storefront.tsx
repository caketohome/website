"use client";

import { motion } from "framer-motion";
import { Heading, Text, Button } from "@medusajs/ui";
import { ProductCard } from "../catalog/product-card";
import Link from "next/link";
import Image from "next/image";

interface LuxuryStorefrontProps {
    sections: any[];
    banners: any[];
    allProducts: any[];
    allCategories: any[];
    occasions: any[];
    announcementBar?: any;
}

export function LuxuryStorefront({ allProducts, allCategories }: LuxuryStorefrontProps) {
    const featuredProducts = allProducts.filter(p => p.is_featured || p.is_bestseller).slice(0, 4);
    const standardProducts = allProducts.filter(p => !p.is_featured && !p.is_bestseller).slice(0, 8);

    // 1. Hardware-accelerated fluid scroll animations
    const fadeUp = {
        hidden: { opacity: 0, y: 24 },
        visible: { 
            opacity: 1, 
            y: 0, 
            transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const } 
        }
    };

    const staggerContainer = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.15,
                delayChildren: 0.1
            }
        }
    };

    return (
        <div className="flex flex-col w-full min-h-screen text-[#FAF9F6] selection:bg-[#B76E79]/30 selection:text-[#FAF9F6]"
             style={{ backgroundImage: 'radial-gradient(ellipse at top right, #1d2d5a 0%, #142040 50%, #0c1326 100%)' }}>
            
            {/* Hero Section */}
            <section className="relative w-full min-h-[90vh] flex flex-col md:flex-row items-center justify-center px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden py-28 md:py-36">
                <div className="flex-1 z-10 flex flex-col gap-6 md:pr-16 relative">
                    {/* Decorative abstract shape behind text */}
                    <div className="absolute -top-32 -left-32 w-64 h-64 bg-[#142040]/50 rounded-full blur-[100px] pointer-events-none" />
                    
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: "-80px" }}
                        variants={fadeUp}
                        className="relative z-10"
                    >
                        <span className="font-sans text-xs uppercase tracking-[0.25em] text-[#D4AF37] font-semibold mb-6 block">
                            Crafted in Bangalore
                        </span>
                        <Heading level="h1" className="font-serif text-5xl md:text-7xl lg:text-[6rem] text-[#FAF9F6] font-normal leading-[1.05] tracking-tight">
                            Modern <br/>
                            <span className="italic text-[#FAF9F6]/80">Patisserie</span>
                        </Heading>
                        <Text className="font-sans text-[#C5CEE0] max-w-md mt-8 text-base md:text-lg leading-relaxed font-light">
                            Exquisite handcrafted cakes and delicate pastries. Prepared with the finest ingredients and an obsessive attention to detail.
                        </Text>
                        <div className="mt-12 flex gap-4">
                            <Link href="/products">
                                <Button className="bg-[#B76E79]/20 hover:bg-[#B76E79] text-[#FAF9F6] hover:text-white font-sans rounded-full px-10 py-4 text-[13px] uppercase tracking-[0.15em] font-medium transition-all duration-500 shadow-[0_20px_50px_rgba(20,32,64,0.35)]">
                                    View Collection
                                </Button>
                            </Link>
                        </div>
                    </motion.div>
                </div>

                <motion.div 
                    initial="hidden"
                    whileInView="visible"
                    variants={fadeUp}
                    viewport={{ once: true, margin: "-80px" }}
                    className="flex-1 relative w-full h-[50vh] md:h-[75vh] mt-20 md:mt-0"
                >
                    <div className="absolute inset-2 md:inset-4 lg:inset-8 rounded-[2rem] overflow-hidden shadow-[0_20px_50px_rgba(20,32,64,0.35)] bg-[#142040]/30 backdrop-blur-xl border border-white/10 hover:border-white/20 transition-colors duration-500">
                        <Image
                            src="https://images.unsplash.com/photo-1559620192-032c4bc4674e?auto=format&fit=crop&q=80&w=1200"
                            alt="Signature Artisanal Cake"
                            fill
                            priority
                            className="object-cover object-center scale-105 hover:scale-100 transition-transform duration-[2s] ease-out"
                        />
                        <motion.div 
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.8, duration: 1 }}
                            className="absolute -bottom-6 -left-6 md:bottom-12 md:-left-8 bg-[#142040]/70 backdrop-blur-2xl border border-white/10 hover:border-white/20 px-6 py-4 rounded-3xl shadow-[0_20px_50px_rgba(20,32,64,0.35)] transition-colors duration-500"
                        >
                            <span className="font-serif text-[#FAF9F6] font-medium text-sm md:text-base flex items-center gap-3 italic">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#B76E79]/40" />
                                Delicate & Refined
                            </span>
                        </motion.div>
                    </div>
                </motion.div>
            </section>

            {/* Curated Signature Collections (Minimalist Grid) */}
            <section className="py-28 md:py-36 px-6 lg:px-8 max-w-7xl mx-auto w-full relative">
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-80px" }}
                    variants={fadeUp}
                    className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8"
                >
                    <div className="max-w-xl">
                        <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-[#D4AF37] font-semibold mb-4 block">
                            Our Offerings
                        </span>
                        <Heading level="h2" className="font-serif text-4xl md:text-5xl lg:text-6xl text-[#FAF9F6] font-normal leading-tight">
                            Signature <br/><span className="italic text-[#FAF9F6]/70">Collections</span>
                        </Heading>
                    </div>
                    <div className="w-24 h-[1px] bg-[#FAF9F6]/10 hidden md:block" />
                </motion.div>

                <motion.div 
                    variants={staggerContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-80px" }}
                    className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-8"
                >
                    {allCategories.slice(0, 3).map((category, index) => (
                        <motion.div 
                            key={category.id} 
                            variants={fadeUp}
                            className={`group cursor-pointer ${
                                index === 0 ? 'md:col-span-4' : index === 1 ? 'md:col-span-5 md:-mt-24' : 'md:col-span-3 md:mt-24'
                            }`}
                        >
                            <Link href={`/products?category=${category.handle || category.name.toLowerCase().replace(/\s+/g, '-')}`}>
                                <div className="flex flex-col gap-6">
                                    <div className="aspect-[3/4] relative rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(20,32,64,0.35)] transition-all duration-700 bg-[#142040]/30 backdrop-blur-xl border border-white/10 group-hover:border-white/20">
                                        <Image
                                            src={category.thumbnail || "https://images.unsplash.com/photo-1557308536-ee471ef2c390?auto=format&fit=crop&q=80&w=800"}
                                            alt={category.name}
                                            fill
                                            className="object-cover scale-100 group-hover:scale-105 transition-all duration-1000 ease-out opacity-90 group-hover:opacity-100"
                                        />
                                        <div className="absolute inset-0 bg-[#142040]/10 group-hover:bg-[#142040]/0 transition-colors duration-500" />
                                    </div>
                                    <div>
                                        <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-[#D4AF37] font-semibold mb-2 block">
                                            Category
                                        </span>
                                        <h3 className="font-serif text-2xl md:text-3xl text-[#FAF9F6] font-medium">
                                            {category.name}
                                        </h3>
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </motion.div>
            </section>

            {/* The Art of Baking Banner */}
            <section className="w-full py-28 md:py-36 relative flex items-center justify-center overflow-hidden border-y border-white/5 bg-[#142040]/20 backdrop-blur-lg">
                <motion.div 
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-80px" }}
                    variants={fadeUp}
                    className="relative z-10 text-center px-6 max-w-4xl mx-auto"
                >
                    <div className="w-12 h-12 rounded-full border border-[#D4AF37]/30 mx-auto mb-10 flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.15)]">
                        <div className="w-2 h-2 rounded-full bg-[#D4AF37]/60" />
                    </div>
                    <Heading level="h2" className="font-serif text-3xl md:text-5xl lg:text-5xl text-[#FAF9F6] leading-[1.3] font-normal italic">
                        "A celebration of minimalism, where every layer tells a story of pure, uncompromised flavor."
                    </Heading>
                    <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-[#C5CEE0] font-semibold mt-12 block">
                        Our Philosophy
                    </span>
                </motion.div>
            </section>

            {/* Featured Luxury Confections Grid */}
            <section className="py-28 md:py-36 px-6 lg:px-8 max-w-7xl mx-auto w-full">
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-80px" }}
                    variants={fadeUp}
                    className="flex flex-col items-center text-center mb-20"
                >
                    <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-[#D4AF37] font-bold mb-4 block">
                        Curated
                    </span>
                    <Heading level="h2" className="font-serif text-4xl md:text-5xl text-[#FAF9F6] font-normal">
                        Bespoke Creations
                    </Heading>
                </motion.div>

                <motion.div 
                    variants={staggerContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-80px" }}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
                >
                    {featuredProducts.map((product) => (
                        <motion.div 
                            key={product.id || product.product_id} 
                            variants={fadeUp}
                            className="h-full"
                        >
                            <ProductCard product={product as any} />
                        </motion.div>
                    ))}
                </motion.div>

                {/* Secondary standard grid to pad out the page */}
                {standardProducts.length > 0 && (
                    <motion.div 
                        variants={staggerContainer}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: "-80px" }}
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-16 md:mt-24"
                    >
                        {standardProducts.map((product) => (
                            <motion.div 
                                key={product.id || product.product_id} 
                                variants={fadeUp}
                                className="h-full"
                            >
                                <ProductCard product={product as any} />
                            </motion.div>
                        ))}
                    </motion.div>
                )}

                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-80px" }}
                    variants={fadeUp}
                    className="mt-20 flex justify-center"
                >
                    <Link href="/products">
                        <Button className="bg-[#142040]/50 border border-white/10 hover:border-white/30 text-[#FAF9F6] font-sans rounded-full px-10 py-4 text-[13px] uppercase tracking-[0.15em] font-medium transition-colors duration-500 backdrop-blur-lg">
                            Explore All Creations
                        </Button>
                    </Link>
                </motion.div>
            </section>
        </div>
    );
}
