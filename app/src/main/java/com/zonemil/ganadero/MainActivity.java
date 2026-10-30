package com.zonemil.ganadero;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.Locale;

/**
 * ZONEMIL GANADERO para Android: la interfaz (assets/www) corre en un WebView y este
 * puente nativo guarda los datos en el almacenamiento interno de la app, comparte
 * archivos, imprime/guarda PDF, importa respaldos y valida el código de instalación.
 */
public class MainActivity extends Activity {

    // Misma URL de validación que instalador.iss (hoja de Google del proveedor)
    static final String ACTIVACION_URL =
            "https://script.google.com/macros/s/AKfycbyjn0Sc6KzrDzDrrYUUctafIQm8yw7FRnS4X9PNiJ7SNLqhlw7Qm1XQFj_18mt8JMkg/exec";
    static final String ARCHIVO_DATOS = "ganadero.json";
    static final int PEDIR_IMPORTAR = 41;

    private WebView web;
    private WebView webImpresion; // se conserva mientras dura la impresión
    private SharedPreferences prefs;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.parseColor("#451a03"));
        prefs = getSharedPreferences("zonemil", MODE_PRIVATE);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#f1f5f9"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setTextZoom(100);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Puente(), "Android");
        setContentView(web);
        web.loadUrl("file:///android_asset/www/index.html");
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.onAtras ? window.onAtras() : false", valor -> {
            if (!"true".equals(valor)) MainActivity.super.onBackPressed();
        });
    }

    private void llamarJS(String funcion, String argumento) {
        String js = "window." + funcion + " && window." + funcion + "(" + JSONObject.quote(argumento) + ")";
        runOnUiThread(() -> web.evaluateJavascript(js, null));
    }

    private static String leerTodo(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        in.close();
        return new String(out.toByteArray(), StandardCharsets.UTF_8);
    }

    private static void escribir(File f, String texto) throws Exception {
        File tmp = new File(f.getPath() + ".tmp");
        try (OutputStream o = new FileOutputStream(tmp)) {
            o.write(texto.getBytes(StandardCharsets.UTF_8));
        }
        if (!tmp.renameTo(f)) {
            try (OutputStream o = new FileOutputStream(f)) {
                o.write(texto.getBytes(StandardCharsets.UTF_8));
            }
            tmp.delete();
        }
    }

    private void respaldoDiario(String texto) {
        try {
            File carpeta = new File(getFilesDir(), "respaldos");
            if (!carpeta.exists()) carpeta.mkdirs();
            String hoy = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
            File destino = new File(carpeta, "ganadero_" + hoy + ".json");
            if (!destino.exists()) escribir(destino, texto);
            File[] lista = carpeta.listFiles((d, n) -> n.startsWith("ganadero_") && n.endsWith(".json"));
            if (lista != null && lista.length > 10) {
                Arrays.sort(lista);
                for (int i = 0; i < lista.length - 10; i++) lista[i].delete();
            }
        } catch (Exception ignored) {
        }
    }

    private String idEquipo() {
        String id = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
        if (id == null || id.trim().isEmpty()) id = Build.MANUFACTURER + Build.MODEL;
        return ("AND" + id).toUpperCase(Locale.US).replaceAll("[^A-Z0-9-]", "");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PEDIR_IMPORTAR && resultCode == RESULT_OK && data != null && data.getData() != null) {
            try {
                InputStream in = getContentResolver().openInputStream(data.getData());
                llamarJS("onImportar", leerTodo(in));
            } catch (Exception e) {
                Toast.makeText(this, "No se pudo leer el archivo: " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        }
    }

    /** Métodos disponibles en JavaScript como window.Android.* */
    class Puente {

        @JavascriptInterface
        public String leer() {
            try {
                File f = new File(getFilesDir(), ARCHIVO_DATOS);
                if (!f.exists()) return null;
                return leerTodo(new FileInputStream(f));
            } catch (Exception e) {
                return null;
            }
        }

        @JavascriptInterface
        public void guardar(String texto) {
            try {
                escribir(new File(getFilesDir(), ARCHIVO_DATOS), texto);
                respaldoDiario(texto);
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Error al guardar: " + e.getMessage(), Toast.LENGTH_LONG).show());
            }
        }

        @JavascriptInterface
        public void respaldoPrevio(String texto) {
            try {
                File carpeta = new File(getFilesDir(), "respaldos");
                if (!carpeta.exists()) carpeta.mkdirs();
                String marca = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date());
                escribir(new File(carpeta, "antes_de_importar_" + marca + ".json"), texto);
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public boolean activado() {
            return prefs.getBoolean("activado", false);
        }

        @JavascriptInterface
        public void validarCodigo(String codigo) {
            new Thread(() -> {
                String resp;
                HttpURLConnection c = null;
                try {
                    String limpio = codigo.toUpperCase(Locale.US).replaceAll("[^A-Z0-9-]", "");
                    String url = ACTIVACION_URL + "?codigo=" + URLEncoder.encode(limpio, "UTF-8")
                            + "&equipo=" + URLEncoder.encode(idEquipo(), "UTF-8");
                    // Google Apps Script responde con redirecciones: se siguen manualmente
                    for (int i = 0; i < 5; i++) {
                        c = (HttpURLConnection) new URL(url).openConnection();
                        c.setInstanceFollowRedirects(false);
                        c.setConnectTimeout(15000);
                        c.setReadTimeout(20000);
                        int code = c.getResponseCode();
                        if (code >= 300 && code < 400 && c.getHeaderField("Location") != null) {
                            url = c.getHeaderField("Location");
                            c.disconnect();
                            continue;
                        }
                        break;
                    }
                    if (c.getResponseCode() == 200) {
                        BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8));
                        StringBuilder sb = new StringBuilder();
                        String l;
                        while ((l = r.readLine()) != null) sb.append(l);
                        r.close();
                        resp = sb.toString().trim();
                    } else {
                        resp = "SIN_CONEXION";
                    }
                } catch (Exception e) {
                    resp = "SIN_CONEXION";
                } finally {
                    if (c != null) c.disconnect();
                }
                if ("OK".equals(resp)) prefs.edit().putBoolean("activado", true).apply();
                llamarJS("onValidacion", resp);
            }).start();
        }

        @JavascriptInterface
        public void compartir(String nombre, String contenido, String mime) {
            try {
                File carpeta = new File(getCacheDir(), "compartir");
                if (!carpeta.exists()) carpeta.mkdirs();
                File f = new File(carpeta, nombre);
                escribir(f, contenido);
                Uri uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".archivos", f);
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType(mime);
                i.putExtra(Intent.EXTRA_STREAM, uri);
                i.putExtra(Intent.EXTRA_SUBJECT, nombre);
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                runOnUiThread(() -> startActivity(Intent.createChooser(i, "Guardar o enviar " + nombre)));
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "No se pudo compartir: " + e.getMessage(), Toast.LENGTH_LONG).show());
            }
        }

        @JavascriptInterface
        public void imprimir(String html, String titulo) {
            runOnUiThread(() -> {
                WebView w = new WebView(MainActivity.this);
                webImpresion = w;
                w.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                        String nombre = "ZONEMIL - " + titulo;
                        PrintDocumentAdapter adaptador = view.createPrintDocumentAdapter(nombre);
                        pm.print(nombre, adaptador, new PrintAttributes.Builder()
                                .setMediaSize(PrintAttributes.MediaSize.NA_LETTER).build());
                    }
                });
                w.loadDataWithBaseURL("file:///android_asset/www/", html, "text/html", "UTF-8", null);
            });
        }

        @JavascriptInterface
        public void importar() {
            Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType("*/*");
            runOnUiThread(() -> startActivityForResult(i, PEDIR_IMPORTAR));
        }
    }
}
