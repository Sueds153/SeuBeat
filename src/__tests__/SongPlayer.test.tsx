import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SongPlayer from '../components/SongPlayer';

const defaultProps = {
  audioProgress: 50,
  isPlaying: false,
  isMuted: false,
  hasAudio: true,
  songTitle: 'Minha Canção',
  recipientName: 'Maria',
  recipientNick: 'Princesa',
  whereItHappened: 'Luanda',
  onPlayPause: vi.fn(),
  onToggleMute: vi.fn(),
  onDownloadMP3: vi.fn(),
  onDownloadLyrics: vi.fn(),
};

describe('SongPlayer', () => {
  it('renders the song title', () => {
    render(<SongPlayer {...defaultProps} />);
    expect(screen.getByText('Minha Canção')).toBeTruthy();
  });

  it('renders the recipient info line', () => {
    render(<SongPlayer {...defaultProps} />);
    expect(screen.getByText(/Princesa/)).toBeTruthy();
    expect(screen.getByText(/Luanda/)).toBeTruthy();
  });

  it('shows play button when paused', () => {
    render(<SongPlayer {...defaultProps} isPlaying={false} />);
    expect(screen.getByRole('button', { name: /REPRODUZIR/i })).toBeTruthy();
  });

  it('shows pause button when playing', () => {
    render(<SongPlayer {...defaultProps} isPlaying={true} />);
    expect(screen.getByRole('button', { name: /PAUSAR/i })).toBeTruthy();
  });

  it('calls onPlayPause when play button clicked', async () => {
    const onPlayPause = vi.fn();
    render(<SongPlayer {...defaultProps} onPlayPause={onPlayPause} />);
    const user = userEvent.setup();
    const playBtn = screen.getByRole('button', { name: /REPRODUZIR/i });
    await user.click(playBtn);
    expect(onPlayPause).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleMute when mute button clicked', async () => {
    const onToggleMute = vi.fn();
    render(<SongPlayer {...defaultProps} onToggleMute={onToggleMute} />);
    const user = userEvent.setup();
    const muteBtn = screen.getByTitle('Silenciar');
    await user.click(muteBtn);
    expect(onToggleMute).toHaveBeenCalledTimes(1);
  });

  it('renders download buttons', () => {
    render(<SongPlayer {...defaultProps} />);
    expect(screen.getByText(/Descarregar Áudio/i)).toBeTruthy();
    expect(screen.getByText(/Descarregar Letra/i)).toBeTruthy();
  });
});
