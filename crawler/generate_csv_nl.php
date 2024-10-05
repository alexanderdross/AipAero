<?php

// Sende Email bei Fehler
register_shutdown_function("fatal_handler");
function fatal_handler()
{
    $errfile = "unknown file";
    $errstr = "shutdown";
    $errno = E_CORE_ERROR;
    $errline = 0;

    $error = error_get_last();

    if ($error !== null) {
        $errno = $error["type"];
        $errfile = $error["file"];
        $errline = $error["line"];
        $errstr = $error["message"];

        $from_email = "fakepass.official@gmail.com";

        // Sende Email bei Fehler
        ini_set("SMTP", "smtp.gmail.com");
        ini_set("smtp_port", "465");
        ini_set("username", $from_email);
        ini_set("password", "mwfh codj qxhu tzde");
        ini_set("sendmail_from", $from_email);

        $headers = "From: DrossAir NL CSV Generator <$from_email>\r\n";
        $headers .= "Reply-To: DrossAir CSV Generator <$from_email>\r\n";
        $headers .= "MIME-Version: 1.0" . "\r\n";
        $headers .= "Content-type: text/html; charset=iso-8859-1" . "\r\n";
        $message =
            "Fehler beim Generieren der CSV Dateien:\r\n" .
            $errno .
            ": " .
            $errstr .
            "\r\n" .
            $errfile .
            ":" .
            $errline .
            "\r\n" .
            $errstr;
        $result = mail(
            "nicolas@zedler.xyz",
            "Fehler beim Generieren der CSV Dateien",
            $message,
            $headers,
            "-f$from_email"
        );
        echo $result;
    }
}

include_once "simple_html_dom.php";

// Lade URL von LVNL Hauptseite
$lvnl_url = "https://www.lvnl.nl/diensten/aip";
$lvnl_html = file_get_html($lvnl_url);
// Finde URL von "eAIP"-button
$eaip_url = $lvnl_html->find(".rich-text-content__buttons", 0)->find("a", 0)
    ->href;
// Ersetze 'index-en-GB.html' mit dem Pfad der Tab-Ansicht
$tabs_url = str_replace("index-en-GB.html", "tabs-eAIP-en-GB.html", $eaip_url);
$tabs_html = file_get_html($tabs_url);
// Finde Tabs
$tab1 = $tabs_html->find(".AMDTTabs", 0)->find("a", 0);
$tab2 = $tabs_html->find(".AMDTTabs", 0)->find("a", 1);
// Nutze standardmäßig Tab 1, außer aktuelles Datum entspricht Tab 2
$tab_src = $tab1->href;
if (date("m/Y") == $tab2->plaintext) {
    $tab_srcs = $tab2->href;
}
// Ersetze relativen Tab Pfad zu absolutem Pfad
$tab_url = str_replace("index-en-GB.html", $tab_src, $eaip_url);
$tab_html = file_get_html($tab_url);
// Finde die Details
$aeroports = $tab_html->find("#AD-2details>.Hx");
$heliports = $tab_html->find("#AD-3details>.Hx");

function generate_csv_content($rows, $isAerodome)
{
    // Variablen Scope setzen
    global $eaip_url, $tab_html;

    $csv_content = "Airport,URL,ICAO" . "\n";
    $count = 0;
    foreach ($rows as $row) {
        $aeroport_html = $row->find("a");
        if (count($aeroport_html) == 2) {
            // Splitte "EHDR — DRACHTEN/DRACHTEN" bei "—" in ICAO und Name
            $title_parts = explode("—", $aeroport_html[1]->plaintext);
            $icao = trim(
                str_replace("&nbsp;", "", htmlentities($title_parts[0]))
            );
            $name = trim(
                str_replace("&nbsp;", "", htmlentities($title_parts[1]))
            );
            // Finde Chart Link
            $aerodomeSelector = 'a[title="CHARTS RELATED TO AN AERODROME"]';
            $heliportSelector = 'a[title="CHARTS RELATED TO A HELIPORT"]';
            $selector = $isAerodome ? $aerodomeSelector : $heliportSelector;
            $url = $tab_html->find($selector, $count)->href;
            // Ersetze relative URL zu absolutem Pfad
            $url = str_replace("../", "", $url);
            $url = str_replace("index-en-GB.html", $url, $eaip_url);
            $csv_content .=
                $name . " " . $icao . "," . $url . "," . $icao . "\n";
            echo $icao . ": " . $url;
            echo "\n";
        }
        $count += 1;
    }
    return $csv_content;
}

$aeroports = generate_csv_content($aeroports, true);
$heliports = generate_csv_content($heliports, false);

// Schreibe CSV Dateien
file_put_contents("../csv/airports-nl-vfr.csv", $aeroports);
file_put_contents("../csv/heliports-nl-vfr.csv", $heliports);
echo "Success";

$servername = "91.204.46.140";
$username = "k138565_aip_aero";
$password = "~2H8gv33mH8gv3l";
$dbname = "k138565_aip_aero";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);
// Check connection
if ($conn->connect_error) {
  die("Connection failed: " . $conn->connect_error);
}

$sql = "INSERT INTO aip_aero_airports (firstname, lastname, email)
VALUES ('John', 'Doe', 'john@example.com')";

if ($conn->query($sql) === TRUE) {
  echo "New record created successfully";
} else {
  echo "Error: " . $sql . "<br>" . $conn->error;
}

$conn->close();
?>
