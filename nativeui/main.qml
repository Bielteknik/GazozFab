import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ApplicationWindow {
    id: window
    visible: true
    width: 1280
    height: 800
    title: "GazozFab Otomasyon HMI"

    // Custom Theme Colors (Premium HSL-like sleek dark mode)
    readonly property color colorBg: "#0D1016"
    readonly property color colorCard: "#151921"
    readonly property color colorBorder: "#2D333F"
    readonly property color colorPrimary: "#3B82F6"
    readonly property color colorSuccess: "#10B981"
    readonly property color colorWarning: "#F59E0B"
    readonly property color colorDanger: "#EF4444"
    readonly property color colorText: "#F3F4F6"
    readonly property color colorMuted: "#6B7280"

    // Safe access wrapper for state data
    property var stateData: uiBridge.systemState || {}

    background: Rectangle {
        color: window.colorBg
    }

    // Active View Tab: "DASHBOARD", "OPERATOR", "SETTINGS"
    property string activeTab: "DASHBOARD"

    // Messages Tab: "LOGS", "ALERTS"
    property string activeMsgTab: "LOGS"

    // Local Operator variables
    property string fillMethod: "SEQUENTIAL"

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 12
        spacing: 12

        // ================= HEADER BAR =================
        Rectangle {
            Layout.fillWidth: true
            height: 64
            color: window.colorCard
            border.color: window.colorBorder
            border.width: 1
            radius: 6
            Layout.preferredHeight: 64

            RowLayout {
                anchors.fill: parent
                anchors.margins: 10
                spacing: 15

                // Title and Status Badge
                ColumnLayout {
                    spacing: 2
                    RowLayout {
                        spacing: 8
                        Text {
                            text: "GAZOZFAB HMI OTOMASYON"
                            color: window.colorText
                            font.bold: true
                            font.pointSize: 13
                        }
                        Rectangle {
                            width: 12
                            height: 12
                            radius: 6
                            color: {
                                var mode = window.stateData.mode || "BEKLEMEDE";
                                if (mode === "OTOMATİK") return window.colorSuccess;
                                if (mode === "YIKAMA") return window.colorPrimary;
                                if (mode === "ARIZA") return window.colorDanger;
                                return window.colorMuted;
                            }
                            // Pulse animation if in active mode
                            SequentialAnimation on opacity {
                                loops: Animation.Infinite
                                running: (window.stateData.mode === "OTOMATİK" || window.stateData.mode === "YIKAMA" || window.stateData.mode === "ARIZA")
                                PropertyAnimation { to: 0.3; duration: 600 }
                                PropertyAnimation { to: 1.0; duration: 600 }
                            }
                        }
                    }
                    Text {
                        text: {
                            var mode = window.stateData.mode || "BEKLEMEDE";
                            var autoState = window.stateData.autoState || "BEKLEMEDE";
                            if (mode === "OTOMATİK") return "Otomatik Döngü Aktif: " + autoState;
                            if (mode === "YIKAMA") return "Yıkama Modu Aktif (Tüm Valfler Pulsing)";
                            if (mode === "ARIZA") return "Kritik Sistem Arızası!";
                            return "Sistem Hazır - Beklemede";
                        }
                        color: window.colorMuted
                        font.pointSize: 9
                    }
                }

                // View Tabs Switcher
                RowLayout {
                    Layout.alignment: Qt.AlignHCenter
                    spacing: 4
                    Repeater {
                        model: [
                            { tag: "DASHBOARD", label: "Ana Kontrol" },
                            { tag: "OPERATOR", label: "Operatör Kontrolü" },
                            { tag: "SETTINGS", label: "Donanım & Ayarlar" }
                        ]
                        Button {
                            text: modelData.label
                            checked: window.activeTab === modelData.tag
                            onClicked: window.activeTab = modelData.tag
                            
                            contentItem: Text {
                                text: parent.text
                                color: parent.checked ? window.colorText : window.colorMuted
                                horizontalAlignment: Text.AlignHCenter
                                verticalAlignment: Text.AlignVCenter
                                font.bold: parent.checked
                                font.pointSize: 10
                            }
                            background: Rectangle {
                                implicitWidth: 140
                                implicitHeight: 36
                                color: parent.checked ? window.colorPrimary : "transparent"
                                border.color: parent.checked ? window.colorPrimary : window.colorBorder
                                border.width: 1
                                radius: 4
                            }
                        }
                    }
                }

                // Quick Mode Control Actions
                RowLayout {
                    Layout.alignment: Qt.AlignRight
                    spacing: 8

                    Button {
                        text: "ÜRETİMİ BAŞLAT"
                        visible: window.activeTab === "DASHBOARD" && window.stateData.mode !== "OTOMATİK" && window.stateData.mode !== "YIKAMA"
                        onClicked: uiBridge.sendAction("START_AUTO_CYCLE", {})
                        background: Rectangle {
                            implicitWidth: 130
                            implicitHeight: 36
                            color: "#052E16"
                            border.color: "#14532D"
                            radius: 4
                        }
                        contentItem: Text {
                            text: parent.text
                            color: "#4ADE80"
                            font.bold: true
                            font.pointSize: 9
                            horizontalAlignment: Text.AlignHCenter
                            verticalAlignment: Text.AlignVCenter
                        }
                    }

                    Button {
                        text: "ACİL DURDUR"
                        onClicked: uiBridge.sendAction("TRIGGER_FAULT", { "type": "EMERGENCY_STOP" })
                        background: Rectangle {
                            implicitWidth: 110
                            implicitHeight: 36
                            color: "#991B1B"
                            border.color: window.colorDanger
                            radius: 4
                        }
                        contentItem: Text {
                            text: parent.text
                            color: "#FEE2E2"
                            font.bold: true
                            font.pointSize: 9
                            horizontalAlignment: Text.AlignHCenter
                            verticalAlignment: Text.AlignVCenter
                        }
                    }
                }
            }
        }

        // ================= MAIN CONTENT VIEWS =================
        StackLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            currentIndex: {
                if (window.activeTab === "DASHBOARD") return 0;
                if (window.activeTab === "OPERATOR") return 1;
                return 2;
            }

            // --- VIEW 0: DASHBOARD ---
            RowLayout {
                spacing: 12

                // Left Part: Conveyor and Logs
                ColumnLayout {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    spacing: 12

                    // Conveyor Belt Panel
                    Rectangle {
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        color: window.colorCard
                        border.color: window.colorBorder
                        radius: 6

                        Text {
                            text: "GÖRSEL AKIŞ VE HARDWARE"
                            anchors.top: parent.top
                            anchors.left: parent.left
                            anchors.margins: 10
                            color: window.colorMuted
                            font.bold: true
                            font.pointSize: 9
                        }

                        // Target / Counter stats
                        RowLayout {
                            anchors.top: parent.top
                            anchors.left: parent.left
                            anchors.right: parent.right
                            anchors.topMargin: 35
                            anchors.leftMargin: 15
                            anchors.rightMargin: 15
                            spacing: 20

                            // Input counter
                            Rectangle {
                                width: 110; height: 50; color: "#0A0D14"
                                border.color: window.colorBorder; radius: 4
                                ColumnLayout {
                                    anchors.centerIn: parent; spacing: 2
                                    Text { text: "GİRİŞ"; color: window.colorMuted; font.pointSize: 8; Layout.alignment: Qt.AlignHCenter }
                                    Text { text: String(window.stateData.inputCount || 0); color: window.colorWarning; font.bold: true; font.pointSize: 14; Layout.alignment: Qt.AlignHCenter }
                                }
                            }

                            // Target Count
                            Rectangle {
                                width: 90; height: 50; color: "#0A0D14"
                                border.color: "#312E81"; radius: 4
                                ColumnLayout {
                                    anchors.centerIn: parent; spacing: 2
                                    Text { text: "HEDEF"; color: "#818CF8"; font.pointSize: 8; Layout.alignment: Qt.AlignHCenter }
                                    Text { text: String(window.stateData.config?.targetCount || 0); color: "#60A5FA"; font.bold: true; font.pointSize: 14; Layout.alignment: Qt.AlignHCenter }
                                }
                            }

                            Spacer { Layout.fillWidth: true }

                            // Output counter
                            Rectangle {
                                width: 110; height: 50; color: "#0A0D14"
                                border.color: window.colorBorder; radius: 4
                                ColumnLayout {
                                    anchors.centerIn: parent; spacing: 2
                                    Text { text: "ÇIKIŞ"; color: window.colorMuted; font.pointSize: 8; Layout.alignment: Qt.AlignHCenter }
                                    Text { text: String(window.stateData.outputCount || 0); color: window.colorSuccess; font.bold: true; font.pointSize: 14; Layout.alignment: Qt.AlignHCenter }
                                }
                            }
                        }

                        // Simulated Conveyor Area
                        Rectangle {
                            height: 180
                            anchors.left: parent.left
                            anchors.right: parent.right
                            anchors.bottom: parent.bottom
                            anchors.bottomMargin: 15
                            anchors.leftMargin: 15
                            anchors.rightMargin: 15
                            color: "#08090C"
                            border.color: "#1E293B"
                            radius: 4

                            // Conveyor belt visual lines
                            Rectangle {
                                anchors.left: parent.left; anchors.right: parent.right
                                anchors.bottom: parent.bottom; anchors.bottomMargin: 30
                                height: 4
                                color: "#475569"
                            }

                            // Input Gate Representation
                            Rectangle {
                                width: 10; height: 100
                                anchors.left: parent.left; anchors.leftMargin: 60
                                anchors.bottom: parent.bottom; anchors.bottomMargin: 30
                                color: window.stateData.inputGate?.isOpen ? window.colorSuccess : window.colorDanger
                                opacity: 0.8
                                Behavior on color { ColorAnimation { duration: 250 } }
                                Text {
                                    text: "GİRİŞ"
                                    color: "white"
                                    font.pointSize: 7
                                    anchors.bottom: parent.top
                                    anchors.horizontalCenter: parent.horizontalCenter
                                }
                            }

                            // Output Gate Representation
                            Rectangle {
                                width: 10; height: 100
                                anchors.right: parent.right; anchors.rightMargin: 60
                                anchors.bottom: parent.bottom; anchors.bottomMargin: 30
                                color: window.stateData.outputGate?.isOpen ? window.colorSuccess : window.colorDanger
                                opacity: 0.8
                                Behavior on color { ColorAnimation { duration: 250 } }
                                Text {
                                    text: "ÇIKIŞ"
                                    color: "white"
                                    font.pointSize: 7
                                    anchors.bottom: parent.top
                                    anchors.horizontalCenter: parent.horizontalCenter
                                }
                            }

                            // Valves Grid in the center
                            Row {
                                anchors.horizontalCenter: parent.horizontalCenter
                                anchors.bottom: parent.bottom
                                anchors.bottomMargin: 35
                                spacing: 30

                                Repeater {
                                    model: window.stateData.valves || []
                                    delegate: Column {
                                        spacing: 4
                                        Rectangle {
                                            width: 32
                                            height: 48
                                            radius: 3
                                            color: modelData.isOpen ? "#1E40AF" : "#334155"
                                            border.color: modelData.enabled ? (modelData.isOpen ? "#3B82F6" : "#475569") : "#7F1D1D"
                                            border.width: 2

                                            Text {
                                                text: modelData.name || String(modelData.id)
                                                anchors.centerIn: parent
                                                color: modelData.enabled ? "white" : "#EF4444"
                                                font.bold: true
                                                font.pointSize: 8
                                            }

                                            // Liquid flow drop visual
                                            Rectangle {
                                                width: 4; height: 30
                                                color: "#60A5FA"
                                                anchors.top: parent.bottom
                                                anchors.horizontalCenter: parent.horizontalCenter
                                                visible: modelData.isOpen
                                                
                                                SequentialAnimation on opacity {
                                                    loops: Animation.Infinite
                                                    running: modelData.isOpen
                                                    PropertyAnimation { to: 0.1; duration: 400 }
                                                    PropertyAnimation { to: 1.0; duration: 400 }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Tabs (Logs & Alerts)
                    Rectangle {
                        Layout.fillWidth: true
                        height: 180
                        color: window.colorCard
                        border.color: window.colorBorder
                        radius: 6
                        Layout.preferredHeight: 180

                        RowLayout {
                            id: msgTabs
                            anchors.top: parent.top
                            anchors.left: parent.left
                            anchors.right: parent.right
                            height: 32

                            Button {
                                text: "HABERLEŞME MESAJLARI"
                                checked: window.activeMsgTab === "LOGS"
                                onClicked: window.activeMsgTab = "LOGS"
                                background: Rectangle {
                                    color: parent.checked ? "#0D1016" : "transparent"
                                    border.color: window.colorBorder
                                }
                                contentItem: Text {
                                    text: parent.text
                                    color: parent.checked ? window.colorSuccess : window.colorMuted
                                    font.bold: parent.checked
                                    font.pointSize: 8
                                    horizontalAlignment: Text.AlignHCenter
                                    verticalAlignment: Text.AlignVCenter
                                }
                            }

                            Button {
                                text: "AKTİF UYARILAR"
                                checked: window.activeMsgTab === "ALERTS"
                                onClicked: window.activeMsgTab = "ALERTS"
                                background: Rectangle {
                                    color: parent.checked ? "#0D1016" : "transparent"
                                    border.color: window.colorBorder
                                }
                                contentItem: Text {
                                    text: parent.text
                                    color: parent.checked ? window.colorWarning : window.colorMuted
                                    font.bold: parent.checked
                                    font.pointSize: 8
                                    horizontalAlignment: Text.AlignHCenter
                                    verticalAlignment: Text.AlignVCenter
                                }
                            }
                            
                            Spacer { Layout.fillWidth: true }
                        }

                        // Content List
                        ListView {
                            anchors.top: msgTabs.bottom
                            anchors.bottom: parent.bottom
                            anchors.left: parent.left
                            anchors.right: parent.right
                            anchors.margins: 10
                            clip: true
                            model: window.activeMsgTab === "LOGS" ? (window.stateData.terminalLogs || []) : (window.stateData.activeAlerts || [])
                            delegate: Text {
                                text: {
                                    if (window.activeMsgTab === "LOGS") return modelData;
                                    return "[" + modelData.code + "] " + modelData.message;
                                }
                                color: {
                                    if (window.activeMsgTab === "LOGS") return "#34D399";
                                    return modelData.severity === "CRITICAL" ? window.colorDanger : window.colorWarning;
                                }
                                font.family: "Monospace"
                                font.pointSize: 9
                            }
                        }
                    }
                }

                // Right Part: Recipe & Kettle info
                ColumnLayout {
                    width: 380
                    Layout.fillHeight: true
                    spacing: 12
                    Layout.preferredWidth: 380

                    // Kettle Seviye Panel
                    Rectangle {
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        color: window.colorCard
                        border.color: window.colorBorder
                        radius: 6

                        Text {
                            text: "ŞERBET TANKI SEVİYESİ"
                            anchors.top: parent.top
                            anchors.left: parent.left
                            anchors.margins: 10
                            color: window.colorMuted
                            font.bold: true
                            font.pointSize: 9
                        }

                        // Simulated fluid tank
                        Rectangle {
                            width: 140; height: 200
                            anchors.centerIn: parent
                            color: "#08090C"
                            border.color: "#334155"
                            border.width: 2
                            radius: 8
                            clip: true

                            // Liquid level fill
                            Rectangle {
                                width: parent.width - 4
                                anchors.bottom: parent.bottom
                                anchors.bottomMargin: 2
                                anchors.horizontalCenter: parent.horizontalCenter
                                height: {
                                    var maxH = window.stateData.config?.ultrasonicMaxHeightCm || 100;
                                    var level = window.stateData.tankLevelCm !== undefined ? window.stateData.tankLevelCm : 85;
                                    var liquidH = Math.max(0, maxH - level);
                                    var liquidP = Math.max(0, Math.min(100, (liquidH / maxH)));
                                    return parent.height * liquidP;
                                }
                                color: (height / parent.height < 0.15) ? "#7F1D1D" : "#D97706"
                                Behavior on height { NumberAnimation { duration: 500 } }
                            }

                            // Text overlay
                            ColumnLayout {
                                anchors.centerIn: parent
                                spacing: 2
                                Text {
                                    text: {
                                        var maxH = window.stateData.config?.ultrasonicMaxHeightCm || 100;
                                        var level = window.stateData.tankLevelCm !== undefined ? window.stateData.tankLevelCm : 85;
                                        var liquidH = Math.max(0, maxH - level);
                                        var liquidP = Math.max(0, Math.min(100, Math.round((liquidH / maxH) * 100)));
                                        return "%" + liquidP;
                                    }
                                    color: "white"
                                    font.bold: true
                                    font.pointSize: 18
                                    Layout.alignment: Qt.AlignHCenter
                                }
                                Text {
                                    text: {
                                        var maxH = window.stateData.config?.ultrasonicMaxHeightCm || 100;
                                        var level = window.stateData.tankLevelCm !== undefined ? window.stateData.tankLevelCm : 85;
                                        var liquidH = Math.max(0, maxH - level);
                                        return liquidH + " cm";
                                    }
                                    color: window.colorMuted
                                    font.pointSize: 8
                                    Layout.alignment: Qt.AlignHCenter
                                }
                            }
                        }
                    }

                    // Recipe panel
                    Rectangle {
                        Layout.fillWidth: true
                        height: 250
                        color: window.colorCard
                        border.color: window.colorBorder
                        radius: 6
                        Layout.preferredHeight: 250

                        Text {
                            text: "REÇETE SEÇİMİ"
                            anchors.top: parent.top
                            anchors.left: parent.left
                            anchors.margins: 10
                            color: window.colorMuted
                            font.bold: true
                            font.pointSize: 9
                        }

                        ListView {
                            anchors.top: parent.top
                            anchors.bottom: parent.bottom
                            anchors.left: parent.left
                            anchors.right: parent.right
                            anchors.topMargin: 35
                            anchors.bottomMargin: 10
                            anchors.leftMargin: 10
                            anchors.rightMargin: 10
                            clip: true
                            model: window.stateData.recipes || []
                            spacing: 6

                            delegate: Button {
                                width: parent.width
                                height: 45
                                property bool isSelected: window.stateData.config?.recipeId === modelData.id
                                onClicked: uiBridge.sendAction("SELECT_RECIPE", { "id": modelData.id })
                                
                                background: Rectangle {
                                    color: parent.isSelected ? "#1E3A8A" : "#1F2937"
                                    border.color: parent.isSelected ? "#3B82F6" : "transparent"
                                    radius: 4
                                }
                                contentItem: RowLayout {
                                    anchors.fill: parent
                                    anchors.margins: 8
                                    Text {
                                        text: modelData.name
                                        color: "white"
                                        font.bold: true
                                        font.pointSize: 10
                                    }
                                    Spacer { Layout.fillWidth: true }
                                    Text {
                                        text: modelData.targetCount + " Adet / " + (modelData.fillTimeMs/1000) + "s"
                                        color: window.colorMuted
                                        font.pointSize: 8
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // --- VIEW 1: OPERATOR CONTROL ---
            RowLayout {
                spacing: 12

                // Manual Operations grid
                ColumnLayout {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    spacing: 12

                    Rectangle {
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        color: window.colorCard
                        border.color: window.colorBorder
                        radius: 6

                        Text {
                            text: "MANUEL DÖNGÜ TETİKLEMELERİ"
                            anchors.top: parent.top
                            anchors.left: parent.left
                            anchors.margins: 10
                            color: window.colorMuted
                            font.bold: true
                            font.pointSize: 9
                        }

                        ColumnLayout {
                            anchors.fill: parent
                            anchors.topMargin: 40
                            anchors.margins: 20
                            spacing: 15

                            RowLayout {
                                spacing: 10
                                Text {
                                    text: "1. Giriş Kilidi"
                                    color: "white"
                                    font.bold: true
                                    font.pointSize: 10
                                    Layout.preferredWidth: 120
                                }
                                Button {
                                    text: (window.stateData.inputGate?.isOpen) ? "GİRİŞİ KAPAT" : "GİRİŞİ AÇ"
                                    onClicked: {
                                        var targetPos = (window.stateData.inputGate?.isOpen) ? 0 : 400;
                                        uiBridge.sendAction("OPERATE_GATE", { "target": "inputGate", "position": targetPos });
                                    }
                                    background: Rectangle {
                                        implicitWidth: 150; implicitHeight: 36
                                        color: (window.stateData.inputGate?.isOpen) ? "#7F1D1D" : "#065F46"
                                        radius: 4
                                    }
                                    contentItem: Text { text: parent.text; color: "white"; font.bold: true; font.pointSize: 9; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                                }
                            }

                            RowLayout {
                                spacing: 10
                                Text {
                                    text: "2. Şerbet Dolumu"
                                    color: "white"
                                    font.bold: true
                                    font.pointSize: 10
                                    Layout.preferredWidth: 120
                                }
                                ComboBox {
                                    id: fillMethodCombo
                                    model: ["Sıralı Doldur (Tek Tek)", "Eşzamanlı Doldur (Hepsi)"]
                                    currentIndex: 0
                                    onCurrentIndexChanged: {
                                        window.fillMethod = currentIndex === 0 ? "SEQUENTIAL" : "CONCURRENT";
                                    }
                                    Layout.preferredWidth: 200
                                }
                                Button {
                                    text: "MANUEL DOLUM TETİKLE"
                                    onClicked: uiBridge.sendAction("START_OPERATOR_FILL", { "method": window.fillMethod })
                                    background: Rectangle {
                                        implicitWidth: 180; implicitHeight: 36
                                        color: "#1E3A8A"; radius: 4
                                    }
                                    contentItem: Text { text: parent.text; color: "white"; font.bold: true; font.pointSize: 9; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                                }
                            }

                            RowLayout {
                                spacing: 10
                                Text {
                                    text: "3. Çıkış Kilidi"
                                    color: "white"
                                    font.bold: true
                                    font.pointSize: 10
                                    Layout.preferredWidth: 120
                                }
                                Button {
                                    text: (window.stateData.outputGate?.isOpen) ? "TAHLİYEYİ DURDUR" : "TAHLİYEYİ BAŞLAT"
                                    onClicked: {
                                        var targetPos = (window.stateData.outputGate?.isOpen) ? 0 : 400;
                                        uiBridge.sendAction("OPERATE_GATE", { "target": "outputGate", "position": targetPos });
                                    }
                                    background: Rectangle {
                                        implicitWidth: 150; implicitHeight: 36
                                        color: (window.stateData.outputGate?.isOpen) ? "#7F1D1D" : "#D97706"
                                        radius: 4
                                    }
                                    contentItem: Text { text: parent.text; color: "white"; font.bold: true; font.pointSize: 9; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                                }
                            }
                        }
                    }
                }

                // Individual Valve Pulse test area
                Rectangle {
                    width: 420
                    Layout.fillHeight: true
                    color: window.colorCard
                    border.color: window.colorBorder
                    radius: 6
                    Layout.preferredWidth: 420

                    Text {
                        text: "BİREYSEL VALF DARBE TESTLERİ"
                        anchors.top: parent.top
                        anchors.left: parent.left
                        anchors.margins: 10
                        color: window.colorMuted
                        font.bold: true
                        font.pointSize: 9
                    }

                    ListView {
                        anchors.top: parent.top
                        anchors.bottom: parent.bottom
                        anchors.left: parent.left
                        anchors.right: parent.right
                        anchors.topMargin: 35
                        anchors.margins: 15
                        clip: true
                        model: window.stateData.valves || []
                        spacing: 8

                        delegate: RowLayout {
                            width: parent.width
                            spacing: 10
                            Text {
                                text: modelData.name || "Vana " + modelData.id
                                color: "white"
                                font.bold: true
                                font.pointSize: 10
                                Layout.preferredWidth: 100
                            }
                            Text {
                                text: "Pin: " + modelData.pin
                                color: window.colorMuted
                                font.pointSize: 8
                                Layout.preferredWidth: 60
                            }
                            Button {
                                text: "PULSE (1s)"
                                enabled: modelData.enabled
                                onClicked: uiBridge.sendAction("TEST_VALVE_PULSE", { "id": modelData.id, "duration": 1000 })
                                background: Rectangle {
                                    implicitWidth: 100; implicitHeight: 32
                                    color: modelData.enabled ? "#1E293B" : "#0D1016"
                                    border.color: "#334155"
                                    radius: 4
                                }
                                contentItem: Text { text: parent.text; color: parent.enabled ? "white" : window.colorMuted; font.bold: true; font.pointSize: 8; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                            }
                        }
                    }
                }
            }

            // --- VIEW 2: SETTINGS AND HARDWARE ---
            Rectangle {
                Layout.fillWidth: true
                Layout.fillHeight: true
                color: window.colorCard
                border.color: window.colorBorder
                radius: 6

                Text {
                    text: "SİSTEM VE DONANIM YAPILANDIRMASI"
                    anchors.top: parent.top
                    anchors.left: parent.left
                    anchors.margins: 10
                    color: window.colorMuted
                    font.bold: true
                    font.pointSize: 9
                }

                ScrollView {
                    anchors.fill: parent
                    anchors.topMargin: 40
                    anchors.margins: 20
                    clip: true

                    ColumnLayout {
                        width: parent.width - 20
                        spacing: 20

                        // Controller Nanos Status list
                        Text {
                            text: "Donanım Denetleyiciler (Arduino Nano)"
                            color: window.colorPrimary
                            font.bold: true
                            font.pointSize: 11
                        }

                        Repeater {
                            model: window.stateData.nanos || []
                            delegate: Rectangle {
                                Layout.fillWidth: true
                                height: 50
                                color: "#0D1016"
                                border.color: window.colorBorder
                                radius: 4

                                RowLayout {
                                    anchors.fill: parent
                                    anchors.margins: 10
                                    Text {
                                        text: modelData.name + " (" + modelData.id + ")"
                                        color: "white"
                                        font.bold: true
                                        font.pointSize: 10
                                    }
                                    Spacer { Layout.fillWidth: true }
                                    Text {
                                        text: "Port: " + (modelData.port || "Bilinmiyor")
                                        color: window.colorMuted
                                        font.pointSize: 9
                                    }
                                    Rectangle {
                                        width: 80; height: 24
                                        color: modelData.status === "ONLINE" ? "#065F46" : "#7F1D1D"
                                        radius: 3
                                        Text {
                                            text: modelData.status
                                            color: "white"
                                            font.bold: true
                                            font.pointSize: 8
                                            anchors.centerIn: parent
                                        }
                                    }
                                }
                            }
                        }

                        // Ultrasonic configurations
                        Text {
                            text: "Ultrasonik Seviye Sensörü Kalibrasyonu"
                            color: window.colorPrimary
                            font.bold: true
                            font.pointSize: 11
                        }

                        GridLayout {
                            columns: 2
                            rowSpacing: 10
                            columnSpacing: 20

                            Text { text: "Maksimum Yükseklik (cm):"; color: "white"; font.pointSize: 10 }
                            Text { text: String(window.stateData.config?.ultrasonicMaxHeightCm || 100); color: window.colorWarning; font.bold: true; font.pointSize: 10 }

                            Text { text: "Kritik Boş Limit (%):"; color: "white"; font.pointSize: 10 }
                            Text { text: String(window.stateData.config?.ultrasonicCriticalLowPercent || 15); color: window.colorWarning; font.bold: true; font.pointSize: 10 }

                            Text { text: "Debounce Filtre Süresi (ms):"; color: "white"; font.pointSize: 10 }
                            Text { text: String(window.stateData.config?.ultrasonicDebounceMs || 100); color: window.colorWarning; font.bold: true; font.pointSize: 10 }
                        }
                    }
                }
            }
        }
    }

    // Helper item for Spacing
    component Spacer : Item {
        Layout.fillWidth: false
        Layout.fillHeight: false
    }

    // Initialize state
    Component.onCompleted: {
        uiBridge.update_state()
    }
}
