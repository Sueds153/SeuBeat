import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import WhatsAppHelp from './WhatsAppHelp';

interface Props {
  children: ReactNode;
  stepName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class StepErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[StepErrorBoundary:${this.props.stepName || '?'}]`, error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-stone-900/60 rounded-3xl p-6 md:p-8 border border-red-800/40 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
            <span className="text-xl">⚠️</span>
          </div>
          <div>
            <h3 className="font-serif text-lg text-stone-100 font-bold">
              Erro neste passo
            </h3>
            <p className="text-stone-400 text-sm mt-1">
              {this.props.stepName
                ? `Ocorreu um erro ao processar "${this.props.stepName}".`
                : 'Ocorreu um erro ao processar este passo.'}
            </p>
            <p className="text-stone-500 text-xs mt-1">
              Os outros passos não foram afectados.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={this.handleRetry}
              className="px-5 py-2 bg-amber-500 text-stone-950 rounded-xl font-bold text-xs hover:bg-amber-400 cursor-pointer"
            >
              Tentar novamente
            </button>
            <WhatsAppHelp context="erro_geracao" label="Falar com apoio" />
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
