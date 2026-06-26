package lifecycle

import "context"

// Service defines the service lifecycle interface, unifying initialization and shutdown.
type Service interface {
	// Startup initializes the service, injecting the Wails context.
	Startup(ctx context.Context)
}

// Shutdownable defines the interface for closable services.
type Shutdownable interface {
	// Shutdown closes the service and releases resources.
	Shutdown() error
}

// FullService combines Service and Shutdownable interfaces.
type FullService interface {
	Service
	Shutdownable
}
