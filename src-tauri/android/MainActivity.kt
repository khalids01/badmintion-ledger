package __APP_PACKAGE__

import android.os.Bundle
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    // Fit the entire WebView inside system bars/cutouts, including on older
    // Android WebViews that do not reliably expose CSS safe-area variables.
    val content = findViewById<View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, windowInsets ->
      val types = WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      val safe = windowInsets.getInsets(types)
      view.setPadding(safe.left, safe.top, safe.right, safe.bottom)
      // Only zero the insets handled above. Keep keyboard insets available to
      // the WebView so forms still resize when the software keyboard opens.
      WindowInsetsCompat.Builder(windowInsets)
        .setInsets(types, Insets.NONE)
        .build()
    }
    ViewCompat.requestApplyInsets(content)
  }
}
