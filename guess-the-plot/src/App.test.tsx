import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders landing page title and start button', () => {
  render(<App />);
  expect(screen.getByText(/Guess the Plot/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Start Guessing/i })).toBeInTheDocument();
});
