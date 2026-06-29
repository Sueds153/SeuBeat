import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import WhatsAppHelp from './WhatsAppHelp';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
          <div className="text-center space-y-4 max-w-md">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center">
              <span className="text-3xl">🎵</span>
            </div>
            <h1 className="font-serif text-2xl text-stone-100 font-bold">
              Algo correu mal
            </h1>
            <p className="text-stone-400 text-sm">
              Ocorreu um erro inesperado. Por favor, recarrega a página.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-amber-500 text-stone-950 rounded-xl font-bold text-sm hover:bg-amber-400 cursor-pointer"
            >
              Recarregar
            </button>
            <div className="pt-2">
              <WhatsAppHelp context="erro_fatal" label="Falar com apoio" />
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
