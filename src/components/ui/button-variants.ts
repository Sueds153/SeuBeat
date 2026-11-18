import { cva } from 'class-variance-authority';

// Vive fora de button.tsx para o ficheiro do componente só exportar componentes
// (react-refresh/only-export-components). O barrel `ui/index.ts` continua a
// expor `buttonVariants`, por isso nenhum import de fora muda.
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full font-bold transition-all active:scale-95 cursor-pointer select-none whitespace-nowrap disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60',
  {
    variants: {
      variant: {
        primary: 'bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-stone-950 shadow-lg shadow-amber-500/20 hover:-translate-y-0.5',
        solid: 'bg-amber-500 text-stone-950 hover:bg-amber-400 shadow-md shadow-amber-500/20',
        secondary: 'bg-stone-900 hover:bg-stone-850 text-stone-200 border border-stone-800 hover:border-stone-700',
        ghost: 'bg-transparent hover:bg-stone-900/60 text-stone-300 hover:text-stone-100 border border-transparent',
        outline: 'bg-stone-800 hover:bg-stone-750 text-stone-100 border border-stone-700',
      },
      size: {
        sm: 'px-4 py-2 text-xs',
        md: 'px-6 py-3 text-sm md:text-base',
        lg: 'px-8 py-4 text-sm md:text-base',
        xl: 'px-6 sm:px-10 py-5 text-base md:text-lg',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);
