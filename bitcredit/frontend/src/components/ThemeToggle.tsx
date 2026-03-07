"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "@heroicons/react/24/solid";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    if (!mounted) return <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse"></div>;

    return (
        <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex items-center justify-center p-2 rounded-full transition-colors duration-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white group"
            aria-label="Toggle Dark Mode"
        >
            {theme === "dark" ? (
                <SunIcon className="w-5 h-5 transition-transform group-hover:rotate-45" />
            ) : (
                <MoonIcon className="w-5 h-5 transition-transform group-hover:-rotate-12" />
            )}
        </button>
    );
}
