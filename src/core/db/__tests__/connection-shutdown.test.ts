import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the shutdown logic by importing the module internals.
// The signal handlers are registered at module level in connection.ts.

describe('Graceful DB Shutdown', () => {
  let originalListeners: { SIGTERM: NodeJS.SignalsListener[]; SIGINT: NodeJS.SignalsListener[] };

  beforeEach(() => {
    // Capture listeners before each test
    originalListeners = {
      SIGTERM: process.listeners('SIGTERM') as NodeJS.SignalsListener[],
      SIGINT: process.listeners('SIGINT') as NodeJS.SignalsListener[],
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('AC01: SIGTERM triggers db.close() when db instance exists', async () => {
    // Arrange: We need to verify that the shutdown handler calls closeDb
    // Import the module to get the shutdown handler registered
    const { getDb, closeDb, _getClosingFlag } = await import('../connection.js');

    // Create an in-memory db to simulate an active connection
    const db = getDb(':memory:');
    const closeSpy = vi.spyOn(db, 'close');

    // Prevent process.exit from actually exiting
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

    // Act: Emit SIGTERM
    process.emit('SIGTERM', 'SIGTERM');

    // Assert: db.close() should have been called
    expect(closeSpy).toHaveBeenCalledOnce();
    expect(exitSpy).toHaveBeenCalledWith(0);

    // Cleanup: reset module state
    closeSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('AC02: double signal does not cause error (closing flag prevents re-entry)', async () => {
    // Arrange
    const { getDb, _getClosingFlag, _resetForTest } = await import('../connection.js');

    // Reset state from previous test
    _resetForTest();
    const db = getDb(':memory:');
    const closeSpy = vi.spyOn(db, 'close');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

    // Act: Emit SIGTERM twice — should not throw
    expect(() => {
      process.emit('SIGTERM', 'SIGTERM');
      process.emit('SIGTERM', 'SIGTERM');
    }).not.toThrow();

    // Assert: db.close() called only once due to closing flag
    expect(closeSpy).toHaveBeenCalledOnce();

    // Cleanup
    closeSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('AC01: SIGINT also triggers db.close() when db instance exists', async () => {
    // Arrange
    const { getDb, _resetForTest } = await import('../connection.js');
    _resetForTest();
    const db = getDb(':memory:');
    const closeSpy = vi.spyOn(db, 'close');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

    // Act: Emit SIGINT
    process.emit('SIGINT', 'SIGINT');

    // Assert
    expect(closeSpy).toHaveBeenCalledOnce();
    expect(exitSpy).toHaveBeenCalledWith(0);

    closeSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('AC01: signal handler does nothing when no db instance exists', async () => {
    // Arrange
    const { _resetForTest } = await import('../connection.js');
    _resetForTest(); // Ensure no db instance

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

    // Act & Assert: should not throw even with no db
    expect(() => {
      process.emit('SIGTERM', 'SIGTERM');
    }).not.toThrow();

    // exit should still be called (graceful shutdown even without db)
    expect(exitSpy).toHaveBeenCalledWith(0);

    exitSpy.mockRestore();
  });
});
