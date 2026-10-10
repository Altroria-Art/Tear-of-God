import { Component } from 'react';
import { withTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const { t } = this.props;
      return (
        <main className="flex flex-col items-center justify-center min-h-[60dvh] text-center px-4 py-12">
          <h1 className="text-2xl font-bold text-ink mb-4">{t('common.errorOccurred', 'Something went wrong')}</h1>
          <p className="text-muted mb-8 max-w-md">
            {this.state.error?.message || t('common.unknownError', 'An unknown error occurred.')}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="play-button"
          >
            {t('common.retry', 'Retry')}
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}

const TranslatedErrorBoundary = withTranslation()(ErrorBoundary);

export default function RouteErrorBoundary({ children }) {
  const location = useLocation();
  return <TranslatedErrorBoundary key={location.pathname}>{children}</TranslatedErrorBoundary>;
}
