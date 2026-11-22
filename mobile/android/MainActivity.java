package com.pixelbloom.mobile;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private WebView webView;
    private View connectionError;
    private final Uri appOrigin = Uri.parse(AppConfig.ORIGIN);

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(60, 36, 95));
        getWindow().setNavigationBarColor(Color.rgb(60, 36, 95));

        FrameLayout root = new FrameLayout(this);
        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return request.isForMainFrame() && !isAppOrigin(request.getUrl());
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) connectionError.setVisibility(View.VISIBLE);
            }
        });
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));

        LinearLayout retryPanel = new LinearLayout(this);
        retryPanel.setOrientation(LinearLayout.VERTICAL);
        retryPanel.setGravity(Gravity.CENTER);
        retryPanel.setPadding(32, 32, 32, 32);
        retryPanel.setBackgroundColor(Color.WHITE);
        TextView message = new TextView(this);
        message.setText("Não foi possível conectar ao PixelBloom. Confira a conexão com a rede do servidor.");
        message.setTextSize(18);
        message.setGravity(Gravity.CENTER);
        retryPanel.addView(message);
        Button retry = new Button(this);
        retry.setText("Tentar novamente");
        retry.setOnClickListener(view -> openApp());
        retryPanel.addView(retry);
        connectionError = retryPanel;
        connectionError.setVisibility(View.GONE);
        root.addView(connectionError, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);

        if (state == null || webView.restoreState(state) == null) openApp();
    }

    private boolean isAppOrigin(Uri uri) {
        return appOrigin.getScheme().equals(uri.getScheme())
            && appOrigin.getHost().equalsIgnoreCase(uri.getHost())
            && port(appOrigin) == port(uri);
    }

    private int port(Uri uri) {
        if (uri.getPort() >= 0) return uri.getPort();
        return "https".equals(uri.getScheme()) ? 443 : 80;
    }

    private void openApp() {
        connectionError.setVisibility(View.GONE);
        webView.loadUrl(AppConfig.ORIGIN + AppConfig.START_PATH);
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        webView.saveState(state);
    }

    @Override
    public void onBackPressed() {
        if (connectionError.getVisibility() != View.VISIBLE && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
