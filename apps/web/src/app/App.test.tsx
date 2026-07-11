import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('renders the workspace regions', () => {
    render(<App />);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByLabelText('节点库')).toBeInTheDocument();
    expect(screen.getByLabelText('流水线画布')).toBeInTheDocument();
    expect(screen.getByLabelText('配置面板')).toBeInTheDocument();
    expect(screen.getByLabelText('数据预览')).toBeInTheDocument();
  });
});
