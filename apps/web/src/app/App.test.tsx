import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('renders the workspace regions', () => {
    render(<App />);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByLabelText('节点库')).toBeInTheDocument();
    expect(screen.getByLabelText('流水线设计器')).toBeInTheDocument();
    expect(screen.getByLabelText('节点配置')).toBeInTheDocument();
    expect(screen.getByLabelText('运行数据')).toBeInTheDocument();
  });
});
