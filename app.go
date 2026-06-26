package main

import (
	"context"
	"fmt"
	"lack-client/pkg/apitest"
	"lack-client/pkg/logger"
	"lack-client/pkg/mcpserver"
	"lack-client/pkg/storage"
	"lack-client/pkg/updater"
	"strings"
	"time"

	"github.com/getsentry/sentry-go"

	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

var (
	wailsContext       *context.Context
	secondInstanceArgs []string
)

// App is the main application struct.
type App struct {
	ctx context.Context
}

// NewApp creates a new application instance.
func NewApp() *App {
	return &App{}
}

// startup is called when the application starts.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	// Save context for other callbacks
	wailsContext = &ctx

	// Dynamically set window max size
	if screens, err := runtime.ScreenGetAll(ctx); err == nil && len(screens) > 0 {
		target := screens[0]
		for _, s := range screens {
			if s.IsCurrent {
				target = s
				break
			}
			if s.IsPrimary {
				target = s
			}
		}
		runtime.WindowSetMaxSize(ctx, target.Size.Width, target.Size.Height)
	}
	if err := storage.OpenDefault(); err != nil {
		logger.Error("failed to open Badger DB", "error", err)
	}
	sentry.CaptureMessage("app.startup")
}

// onSecondInstanceLaunch is triggered when the user tries to open a second instance.
func (a *App) onSecondInstanceLaunch(secondInstanceData options.SecondInstanceData) {
	secondInstanceArgs = secondInstanceData.Args
	logger.Info("user opened second instance", "args", strings.Join(secondInstanceData.Args, ","), "workingDir", secondInstanceData.WorkingDirectory)
	if wailsContext != nil {
		runtime.WindowUnminimise(*wailsContext)
		runtime.Show(*wailsContext)
		go runtime.EventsEmit(*wailsContext, "launchArgs", secondInstanceArgs)
	}
}

// domReady is called after the frontend resources have loaded.
func (a App) domReady(ctx context.Context) {
	// Add operations here
}

// beforeClose is called before the application closes.
// Returns true to prevent closing, false to close normally.
func (a *App) beforeClose(ctx context.Context) (prevent bool) {
	// Check and stop MCP local server
	if mcpserver.IsRunning() {
		logger.Info("正在关闭 MCP 本地服务器...")
		if err := mcpserver.Shutdown(); err != nil {
			logger.Error("关闭 MCP 本地服务器失败", "error", err)
		} else {
			logger.Info("MCP 本地服务器已关闭")
		}
	}
	return false
}

// shutdown is called when the application terminates.
func (a *App) shutdown(ctx context.Context) {
	if err := storage.Close(); err != nil {
		logger.Error("关闭 Badger 数据库失败", "error", err)
	}
	sentry.Flush(2 * time.Second)
}

// Greet returns a greeting message.
func (a *App) Greet(name string) string {
	return fmt.Sprintf("测试 %s, It's show time!", name)
}

// TestAPIConnection tests the API connection.
func (a *App) TestAPIConnection(request apitest.Request) apitest.Response {
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	return apitest.TestConnection(ctx, request)
}

// CheckUpdate checks for version updates.
func (a *App) CheckUpdate(currentVersion string) updater.CheckResult {
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	return updater.CheckForUpdate(ctx, currentVersion)
}
