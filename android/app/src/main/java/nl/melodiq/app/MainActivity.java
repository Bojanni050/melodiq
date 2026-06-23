package nl.melodiq.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;
import java.lang.reflect.Method;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            WebSettings settings = getBridge().getWebView().getSettings();
            Method m = settings.getClass().getMethod("setSpatialNavigationEnabled", boolean.class);
            m.invoke(settings, true);
        } catch (Exception ignored) {}
    }
}
