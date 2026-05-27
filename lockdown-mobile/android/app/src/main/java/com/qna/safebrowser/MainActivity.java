package com.qna.safebrowser;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onBackPressed() {
        // Block physical back button completely for security
    }
}
