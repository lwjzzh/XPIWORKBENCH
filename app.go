package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// App struct
type App struct {
	ctx    context.Context
	db     *gorm.DB
	client *http.Client
}

// --- Database Models ---

type AppModel struct {
	ID        string `gorm:"primaryKey"`
	Name      string
	UpdatedAt int64  `gorm:"index"`
	IsPinned  bool   `gorm:"index"`
	Content   string `gorm:"type:text"` // Stores full JSON payload
}

type SessionModel struct {
	ID        string `gorm:"primaryKey"`
	AppID     string `gorm:"index"`
	Name      string
	Type      string
	UpdatedAt int64  `gorm:"index"`
	IsPinned  bool   `gorm:"index"`
	Content   string `gorm:"type:text"` // Stores full JSON payload
}

// --- API Types ---

// ProxyResponse defines the structure returned to frontend
type ProxyResponse struct {
	Success    bool              `json:"success"`
	Status     int               `json:"status"`
	StatusText string            `json:"statusText"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
	Error      string            `json:"error"`
}

// FormDataEntry represents a field in the multipart request defined by frontend
type FormDataEntry struct {
	Key   string `json:"key"`
	Value string `json:"value"` // Can be plain text or Data URI
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		client: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

// startup is called at application startup
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// 1. Determine Data Directory
	configDir, err := os.UserConfigDir()
	if err != nil {
		configDir, _ = os.Getwd()
	}
	appDataDir := filepath.Join(configDir, ".omniflow")
	if err := os.MkdirAll(appDataDir, 0755); err != nil {
		runtime.LogErrorf(a.ctx, "Failed to create data dir: %v", err)
	}

	// 2. Initialize SQLite Database
	// We use glebarez/sqlite for pure Go implementation (no CGO required)
	dbPath := filepath.Join(appDataDir, "omniflow.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		runtime.LogErrorf(a.ctx, "Failed to connect DB: %v", err)
		return
	}

	// 3. Auto Migrate Schema
	if err := db.AutoMigrate(&AppModel{}, &SessionModel{}); err != nil {
		runtime.LogErrorf(a.ctx, "Failed to migrate DB: %v", err)
	}

	a.db = db
}

// --- App Management (SQLite) ---

func (a *App) SaveApp(appJson string) error {
	var partial struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		UpdatedAt int64  `json:"updatedAt"`
		IsPinned  bool   `json:"isPinned"`
	}
	if err := json.Unmarshal([]byte(appJson), &partial); err != nil {
		return fmt.Errorf("invalid json: %v", err)
	}
	if partial.ID == "" {
		return fmt.Errorf("app id is missing")
	}

	model := AppModel{
		ID:        partial.ID,
		Name:      partial.Name,
		UpdatedAt: partial.UpdatedAt,
		IsPinned:  partial.IsPinned,
		Content:   appJson,
	}

	// Upsert: GORM Save will insert or update based on PrimaryKey
	return a.db.Save(&model).Error
}

func (a *App) GetApps() ([]string, error) {
	var models []AppModel
	// Sort by Pinned first, then by UpdatedAt descending
	if err := a.db.Order("is_pinned DESC, updated_at DESC").Find(&models).Error; err != nil {
		return nil, err
	}

	var jsons []string
	for _, m := range models {
		jsons = append(jsons, m.Content)
	}
	return jsons, nil
}

func (a *App) DeleteApp(id string) error {
	return a.db.Delete(&AppModel{}, "id = ?", id).Error
}

// --- Session Management (SQLite) ---

func (a *App) SaveSession(sessionJson string) error {
	var partial struct {
		ID        string `json:"id"`
		AppID     string `json:"appId"`
		Name      string `json:"name"`
		Type      string `json:"type"`
		UpdatedAt int64  `json:"updatedAt"`
		IsPinned  bool   `json:"isPinned"`
	}
	if err := json.Unmarshal([]byte(sessionJson), &partial); err != nil {
		return fmt.Errorf("invalid json: %v", err)
	}
	if partial.ID == "" {
		return fmt.Errorf("session id is missing")
	}

	model := SessionModel{
		ID:        partial.ID,
		AppID:     partial.AppID,
		Name:      partial.Name,
		Type:      partial.Type,
		UpdatedAt: partial.UpdatedAt,
		IsPinned:  partial.IsPinned,
		Content:   sessionJson,
	}

	return a.db.Save(&model).Error
}

func (a *App) GetSessions() ([]string, error) {
	var models []SessionModel
	if err := a.db.Order("updated_at DESC").Find(&models).Error; err != nil {
		return nil, err
	}

	var jsons []string
	for _, m := range models {
		jsons = append(jsons, m.Content)
	}
	return jsons, nil
}

func (a *App) DeleteSession(id string) error {
	return a.db.Delete(&SessionModel{}, "id = ?", id).Error
}

// --- System Dialogs ---

func (a *App) SelectDirectory() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Save Directory",
	})
}

// --- Network Proxy (Unchanged) ---

func (a *App) prepareRequest(method string, urlStr string, headers map[string]string, bodyStr string) (*http.Request, error) {
	var bodyReader io.Reader
	var contentType string

	isMultipart := false
	for k, v := range headers {
		if strings.EqualFold(k, "Content-Type") && strings.Contains(strings.ToLower(v), "multipart/form-data") {
			isMultipart = true
			break
		}
	}

	if isMultipart {
		bodyBuffer := &bytes.Buffer{}
		writer := multipart.NewWriter(bodyBuffer)

		var entries []FormDataEntry
		if err := json.Unmarshal([]byte(bodyStr), &entries); err != nil {
			return nil, fmt.Errorf("failed to parse form data: %v", err)
		}

		for _, entry := range entries {
			if strings.HasPrefix(entry.Value, "data:") && strings.Contains(entry.Value, ";base64,") {
				parts := strings.SplitN(entry.Value, ",", 2)
				if len(parts) != 2 {
					continue
				}
				meta := parts[0]
				dataB64 := parts[1]
				
				mimeType := "application/octet-stream"
				if strings.Contains(meta, ":") && strings.Contains(meta, ";") {
					mimeType = strings.TrimSuffix(strings.Split(strings.Split(meta, ":")[1], ";")[0], "")
				}

				ext := "bin"
				if strings.Contains(mimeType, "/") {
					ext = strings.Split(mimeType, "/")[1]
				}
				filename := fmt.Sprintf("file_%s.%s", entry.Key, ext)

				h := make(textproto.MIMEHeader)
				h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, entry.Key, filename))
				h.Set("Content-Type", mimeType)
				
				part, err := writer.CreatePart(h)
				if err != nil {
					return nil, err
				}

				decoded, err := base64.StdEncoding.DecodeString(dataB64)
				if err != nil {
					return nil, err
				}
				part.Write(decoded)
			} else {
				writer.WriteField(entry.Key, entry.Value)
			}
		}

		if err := writer.Close(); err != nil {
			return nil, err
		}

		bodyReader = bodyBuffer
		contentType = writer.FormDataContentType()
		// Remove existing Content-Type to let writer set boundary
		for k := range headers {
			if strings.EqualFold(k, "Content-Type") {
				delete(headers, k)
			}
		}
	} else {
		if bodyStr != "" {
			bodyReader = strings.NewReader(bodyStr)
		}
	}

	req, err := http.NewRequest(method, urlStr, bodyReader)
	if err != nil {
		return nil, err
	}

	for k, v := range headers {
		req.Header.Set(k, v)
	}
	
	if isMultipart {
		req.Header.Set("Content-Type", contentType)
	}

	return req, nil
}

func (a *App) ProxyRequest(method string, urlStr string, headers map[string]string, bodyStr string) ProxyResponse {
	req, err := a.prepareRequest(method, urlStr, headers, bodyStr)
	if err != nil {
		return ProxyResponse{Success: false, Error: err.Error()}
	}

	resp, err := a.client.Do(req)
	if err != nil {
		return ProxyResponse{Success: false, Error: err.Error()}
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return ProxyResponse{Success: false, Status: resp.StatusCode, Error: err.Error()}
	}

	respHeaders := make(map[string]string)
	for k, v := range resp.Header {
		respHeaders[k] = strings.Join(v, ", ")
	}

	respContentType := resp.Header.Get("Content-Type")
	bodyOutput := string(bodyBytes)
	
	if isBinaryContent(respContentType) {
		b64 := base64.StdEncoding.EncodeToString(bodyBytes)
		bodyOutput = fmt.Sprintf("data:%s;base64,%s", respContentType, b64)
	}

	return ProxyResponse{
		Success:    true,
		Status:     resp.StatusCode,
		StatusText: resp.Status,
		Headers:    respHeaders,
		Body:       bodyOutput,
	}
}

func (a *App) ProxyStreamRequest(requestId string, method string, urlStr string, headers map[string]string, bodyStr string) {
	go func() {
		req, err := a.prepareRequest(method, urlStr, headers, bodyStr)
		if err != nil {
			runtime.EventsEmit(a.ctx, "stream:error:"+requestId, err.Error())
			return
		}

		resp, err := a.client.Do(req)
		if err != nil {
			runtime.EventsEmit(a.ctx, "stream:error:"+requestId, err.Error())
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 400 {
			bodyBytes, _ := io.ReadAll(resp.Body)
			runtime.EventsEmit(a.ctx, "stream:error:"+requestId, fmt.Sprintf("HTTP %d: %s", resp.StatusCode, string(bodyBytes)))
			return
		}

		reader := bufio.NewReader(resp.Body)
		buf := make([]byte, 1024) 

		for {
			n, err := reader.Read(buf)
			if n > 0 {
				chunkB64 := base64.StdEncoding.EncodeToString(buf[:n])
				runtime.EventsEmit(a.ctx, "stream:data:"+requestId, chunkB64)
			}
			if err != nil {
				if err == io.EOF {
					break
				}
				runtime.EventsEmit(a.ctx, "stream:error:"+requestId, err.Error())
				return
			}
		}

		runtime.EventsEmit(a.ctx, "stream:end:"+requestId, "DONE")
	}()
}

func isBinaryContent(ct string) bool {
	ct = strings.ToLower(ct)
	return strings.Contains(ct, "image") || strings.Contains(ct, "audio") || strings.Contains(ct, "video") || strings.Contains(ct, "pdf") || strings.Contains(ct, "octet-stream")
}
