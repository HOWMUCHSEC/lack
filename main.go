package main

import (
	"context"
	"embed"
	"os"
	"strings"
	"time"

	"lack-client/pkg/config"
	"lack-client/pkg/logger"
	"lack-client/pkg/mcpserver"
	"lack-client/pkg/nucleiscan"

	"github.com/getsentry/sentry-go"
	"github.com/wailsapp/wails/v2"
	wailslogger "github.com/wailsapp/wails/v2/pkg/logger"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var icon []byte

//go:embed VERSION
var versionFile string

func main() {
	// 初始化统一日志器（使用 Text 格式，便于开发调试）
	logger.Init(false)

	// 设置嵌入的 nuclei 模板
	nucleiscan.EmbeddedTemplates = nucleiTemplates

	// 从嵌入的 VERSION 文件读取版本号
	version := strings.TrimSpace(versionFile)
	if version == "" {
		version = "v0.0.0"
	}

	if config.SentryDSN != "" {
		_ = sentry.Init(sentry.ClientOptions{
			Dsn:              config.SentryDSN,
			Environment:      config.SentryEnvironment,
			Release:          "lack@" + version,
			EnableTracing:    true,
			TracesSampleRate: config.SentryTracesSampleRate,
			AttachStacktrace: true,
		})
		defer sentry.Flush(2 * time.Second)
	}
	// Create an instance of the app structure
	app := NewApp()
	// Create an instance of the DB service
	db := NewDB()
	scannerSvc := NewScannerService()
	sysSvc := NewSystemService()
	localSvc := mcpserver.NewService()
	sampleSvc := NewSampleService()
	testcaseSvc := NewTestCaseService()
	evalSvc := NewEvalService()
	yamlScanSvc := NewYamlScanService()
	nucleiSvc := NewNucleiService()
	aiCloudSvc := NewAICloudSecurityService()
	dashboardSvc := NewDashboardService()
	reportSvc := NewReportService()

	// Create application with options
	err := wails.Run(&options.App{
		Title:             "Lack - LLM Attack Construction Kit",          // 应用窗口标题
		Width:             1024,                                          // 初始窗口宽度（像素）；<=0 使用默认 1024
		Height:            768,                                           // 初始窗口高度（像素）；<=0 使用默认 768
		DisableResize:     false,                                         // 禁止用户调整窗口大小
		Fullscreen:        false,                                         // 是否全屏启动（false：不全屏）
		Frameless:         false,                                         // 无边框窗口
		MinWidth:          1024,                                          // 窗口最小宽度（像素）；0 表示不限
		MinHeight:         768,                                           // 窗口最小高度（像素）；0 表示不限
		MaxWidth:          0,                                             // 窗口最大宽度（像素）；0 表示不限
		MaxHeight:         0,                                             // 窗口最大高度（像素）；0 表示不限
		StartHidden:       false,                                         // 启动时是否隐藏主窗口
		HideWindowOnClose: false,                                         // 关闭窗口时仅隐藏而不是退出应用
		AlwaysOnTop:       false,                                         // 窗口是否置顶
		BackgroundColour:  &options.RGBA{R: 255, G: 255, B: 255, A: 255}, // 窗口背景颜色（RGBA）

		// 资源（已废弃）：建议改用 AssetServer
		Assets:        nil, // 已废弃：使用 AssetServer.Assets
		AssetsHandler: nil, // 已废弃：使用 AssetServer.Handler

		AssetServer: &assetserver.Options{ // 静态资源服务配置
			Assets: assets, // 前端打包产物（embed.FS）
		},

		Menu:               nil,               // 应用菜单（nil 使用默认菜单）
		Logger:             nil,               // 自定义日志器（nil 使用默认）
		LogLevel:           wailslogger.DEBUG, // 开发环境日志级别
		LogLevelProduction: wailslogger.ERROR, // 生产环境日志级别（默认 ERROR）

		OnStartup: func(ctx context.Context) {
			app.startup(ctx)
			scannerSvc.Startup(ctx)
			sysSvc.Startup(ctx)
			localSvc.Startup(ctx)
			evalSvc.Startup(ctx)
			nucleiSvc.Startup(ctx)
			aiCloudSvc.Startup(ctx)
			dashboardSvc.Startup(ctx)
			reportSvc.Startup(ctx)
		}, // 应用启动回调
		OnDomReady: app.domReady, // 前端 DOM 就绪回调
		OnShutdown: func(ctx context.Context) {
			aiCloudSvc.shutdown()
			app.shutdown(ctx)
		}, // 应用关闭回调
		OnBeforeClose: app.beforeClose, // 关闭窗口前回调；返回 true 可阻止关闭

		Bind:     []interface{}{app, db, scannerSvc, sysSvc, localSvc, sampleSvc, testcaseSvc, evalSvc, yamlScanSvc, nucleiSvc, aiCloudSvc, dashboardSvc, reportSvc}, // 绑定给前端可调用的后端实例
		EnumBind: nil,                                                                                                                                                // 绑定枚举/常量给前端（可选）

		WindowStartState: options.Maximised, // 窗口启动状态（Normal/Maximised/Minimised/Fullscreen）

		ErrorFormatter: nil, // 自定义错误格式化器（将错误转为可序列化对象）

		// 拖拽区域识别（留空使用默认：属性名 --wails-draggable，属性值 drag）
		CSSDragProperty: "", // 可拖拽区域的 CSS 自定义属性名
		CSSDragValue:    "", // 可拖拽区域的 CSS 属性值

		EnableDefaultContextMenu:         false, // 生产环境是否启用浏览器默认右键菜单（开发/调试总是启用）
		EnableFraudulentWebsiteDetection: false, // 启用恶意网站/钓鱼检测（可能上传 URL 等信息到系统服务）

		SingleInstanceLock: &options.SingleInstanceLock{ // 单实例锁配置（阻止多开并接收第二实例参数）
			UniqueId:               "lack-client-1c3d8e35-7a87-4c0f-a4a4-0e9cf60c5f2b",
			OnSecondInstanceLaunch: app.onSecondInstanceLaunch,
		},

		// Windows 平台专用选项
		Windows: &windows.Options{
			WebviewIsTransparent: false, // WebView 背景透明
			WindowIsTranslucent:  false, // 窗口半透明
			DisableWindowIcon:    false, // 隐藏窗口图标
			// DisableFramelessWindowDecorations: false,
			WebviewUserDataPath: "",  // WebView 用户数据目录
			ZoomFactor:          1.0, // WebView 默认缩放
		},
		// Mac 平台专用选项
		Mac: &mac.Options{
			TitleBar: &mac.TitleBar{
				TitlebarAppearsTransparent: false, // 标题栏背景透明
				HideTitle:                  false, // 隐藏标题文本
				HideTitleBar:               false, // 隐藏标题栏
				FullSizeContent:            false, // 内容扩展到标题栏
				UseToolbar:                 true,  // 使用工具栏
				HideToolbarSeparator:       false, // 隐藏工具栏分隔线
			},
			Appearance:           mac.NSAppearanceNameDarkAqua, // UI 外观（深色等）
			WebviewIsTransparent: true,                         // WebView 背景透明
			WindowIsTranslucent:  false,                        // 窗口半透明
			About: &mac.AboutInfo{ // “关于”信息
				Title:   "LLM Attack Construction Kit",
				Message: "",
				Icon:    icon,
			},
		},

		Linux:        nil, // Linux 平台选项（如需自定义可提供 *linux.Options）
		Experimental: nil, // 实验性选项
		Debug: options.Debug{
			OpenInspectorOnStartup: true, // 启动时打开开发者工具（仅调试/开发有效）
		},
		DragAndDrop:          nil,   // 拖拽文件/元素配置（nil 使用默认）
		DisablePanicRecovery: false, // 禁用消息处理中的 panic 恢复（一般保持 false）
	})

	if err != nil {
		logger.Error("Wails 启动失败", "error", err)
		os.Exit(1)
	}
}
