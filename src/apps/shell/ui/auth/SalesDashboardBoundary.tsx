import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; onFailure: () => void };
export class SalesDashboardBoundary extends Component<
  Props,
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? (
      <div role="alert">
        Não foi possível abrir o painel. Atualize a página para tentar
        novamente.
      </div>
    ) : (
      this.props.children
    );
  }
}
