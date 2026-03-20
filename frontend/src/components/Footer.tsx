'use client';
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Facebook, Instagram, Linkedin, Youtube, Laptop2 } from 'lucide-react';

interface AnimatedContainerProps {
	className?: string;
	delay?: number;
	children: React.ReactNode;
}

const footerLinks = [
	{
		label: 'Product',
		links: [
			{ title: 'Features', href: '#features' },
			{ title: 'Study Tracks', href: '#tracks' },
			{ title: 'Leaderboard', href: '#' },
			{ title: 'Pricing', href: '#' },
		],
	},
	{
		label: 'Company',
		links: [
			{ title: 'About Us', href: '#' },
			{ title: 'Careers', href: '#' },
			{ title: 'Privacy Policy', href: '#' },
			{ title: 'Terms of Service', href: '#' },
		],
	},
	{
		label: 'Resources',
		links: [
			{ title: 'Blog', href: '#' },
			{ title: 'Community Discord', href: '#' },
			{ title: 'Help Center', href: '#' },
			{ title: 'Status', href: '#' },
		],
	},
	{
		label: 'Social',
		links: [
			{ title: 'Facebook', href: '#', icon: Facebook },
			{ title: 'Instagram', href: '#', icon: Instagram },
			{ title: 'Youtube', href: '#', icon: Youtube },
			{ title: 'LinkedIn', href: '#', icon: Linkedin },
		],
	},
];

export default function Footer() {
	return (
        // CHANGED: bg-slate-950 -> bg-transparent + backdrop-blur
		<footer className="relative w-full border-t border-white/10 bg-transparent backdrop-blur-sm pt-16 pb-8 md:rounded-t-3xl overflow-hidden mt-20">
			<div className="container mx-auto px-6 relative z-10">
                <div className="grid w-full gap-8 xl:grid-cols-3 xl:gap-8">
                    
                    {/* Brand Section */}
                    <AnimatedContainer className="space-y-4">
                        <div className="flex items-center gap-2">
                             <div className="bg-blue-600/10 p-2 rounded-lg border border-blue-500/20">
                                <Laptop2 className="h-6 w-6 text-blue-400" />
                            </div>
                            <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                                StudySync
                            </span>
                        </div>
                        <p className="text-slate-400 mt-4 text-sm max-w-xs leading-relaxed">
                            The real-time collaboration platform designed for engineering students. Sync notes, code, and quizzes instantly.
                        </p>
                        <p className="text-slate-600 text-xs mt-8">
                            © {new Date().getFullYear()} StudySync Inc. All rights reserved.
                        </p>
                    </AnimatedContainer>

                    {/* Links Grid */}
                    <div className="mt-10 grid grid-cols-2 gap-8 md:grid-cols-4 xl:col-span-2 xl:mt-0">
                        {footerLinks.map((section, index) => (
                            <AnimatedContainer key={section.label} delay={0.1 + index * 0.1}>
                                <div className="mb-10 md:mb-0">
                                    <h3 className="text-sm font-semibold text-slate-200">{section.label}</h3>
                                    <ul className="text-slate-400 mt-4 space-y-3 text-sm">
                                        {section.links.map((link) => (
                                            <li key={link.title}>
                                                <a
                                                    href={link.href}
                                                    className="hover:text-blue-400 inline-flex items-center transition-all duration-300"
                                                >
                                                    {link.icon && <link.icon className="me-2 size-4" />}
                                                    {link.title}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </AnimatedContainer>
                        ))}
                    </div>
                </div>
			</div>
		</footer>
	);
};

function AnimatedContainer({ className, delay = 0.1, children }: AnimatedContainerProps) {
	const shouldReduceMotion = useReducedMotion();
	if (shouldReduceMotion) {
		return <div className={className}>{children}</div>;
	}
	return (
		<motion.div
			initial={{ filter: 'blur(4px)', translateY: 10, opacity: 0 }}
			whileInView={{ filter: 'blur(0px)', translateY: 0, opacity: 1 }}
			viewport={{ once: true }}
			transition={{ delay, duration: 0.8 }}
			className={className}
		>
			{children}
		</motion.div>
	);
};
