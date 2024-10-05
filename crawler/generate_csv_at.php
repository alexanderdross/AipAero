<?php

// Sende Email bei Fehler
register_shutdown_function( "fatal_handler" );
function fatal_handler() {
    $errfile = "unknown file";
    $errstr  = "shutdown";
    $errno   = E_CORE_ERROR;
    $errline = 0;

    $error = error_get_last();

    if($error !== NULL) {
        $errno   = $error["type"];
        $errfile = $error["file"];
        $errline = $error["line"];
        $errstr  = $error["message"];

        $from_email = 'fakepass.official@gmail.com';

        // Sende Email bei Fehler
        ini_set("SMTP", "smtp.gmail.com");
        ini_set("smtp_port", "465");
        ini_set("username", $from_email);
        ini_set("password", "mwfh codj qxhu tzde");
        ini_set("sendmail_from", $from_email);
        
        $headers = "From: DrossAir CSV Generator <$from_email>\r\n";
        $headers .= "Reply-To: DrossAir CSV Generator <$from_email>\r\n";
        $headers .= 'MIME-Version: 1.0' . "\r\n";
        $headers .= 'Content-type: text/html; charset=iso-8859-1' . "\r\n";  
        $message = "Fehler beim Generieren der CSV Dateien:\r\n".$errno.": ".$errstr."\r\n".$errfile.":".$errline."\r\n".$errstr;
        $result = mail('nicolas@zedler.xyz', 'Fehler beim Generieren der CSV Dateien', $message, $headers, "-f$from_email");
        echo $result;
    }
}

include_once('simple_html_dom.php');
$main_url = 'https://eaip.austrocontrol.at'; // Hauptseite des Luftfahrthandbuches Österreich (AIP)
$main_html = file_get_html($main_url);

// Finde URL von "aktuelle Ausgabe / current version"
$current_url = $main_html->find('.current', 0)->find('a', 0)->href;

// Extrahiere "akutelles" Datum aus URL
$current_datum = explode('/', $current_url)[2];

// Bilde unsere URLs
$ad_2_url = $main_url.'/lo/'.$current_datum.'/ad_2.htm'; // AD 2 (Flughäfen/Flugfelder/Militärische Flugplätze)
$ad_3_url = $main_url.'/lo/'.$current_datum.'/ad_3.htm'; // AD 3 (Hubschrauberlandeplätze)

// Lade URLs herunter
$ad_2_html = file_get_html($ad_2_url);
$ad_3_html = file_get_html($ad_3_url);

// Finde alle Table Rows (Tabellenzeilen)
$ad_2_table_rows = $ad_2_html->find('tr');
$ad_3_table_rows = $ad_3_html->find('tr');

function generate_csv_content($table_rows, $main_url, $current_datum) {
    $csv_content = "Airport,URL,ICAO"."\n";

    // Loope durch alle Table Rows
    foreach ($table_rows as $row) {
        // Finde alle Table Cells (Tabellenzellen)
        $cells = $row->find('td');

        // Spalten mit Daten haben 2 Zellen
        if (count($cells) != 2) {
            continue;
        }

        // Extrahiere ICAO Code
        $icao = $cells[0]->find('a', 0)->plaintext;
        // Nehme "Karten/Charts" URL falls verfügbar
        $url = $cells[0]->find('a', 0)->href;
        if (count($cells[0]->find('a')) == 2) {
            $url = $cells[0]->find('a', 1)->href;
        }
        // Ergänze URL vollständig
        $url = $main_url.'/lo/'.$current_datum.'/'.$url;
        $name = $cells[1]->plaintext;
        // Name mit Newline bereinigen
        $name = preg_replace("/[\n\r]/","",$name);
        // Schreibe Daten in $content
        $line = $name.' '.$icao.','.$url.','.$icao."\n";
        $csv_content .= $line;
    }
    if (strlen($csv_content) == 0) {
        throw new Exception('No data found');
    }
    return $csv_content;
}

$ad_2_csv_content = generate_csv_content($ad_2_table_rows, $main_url, $current_datum);
$ad_3_csv_content = generate_csv_content($ad_3_table_rows, $main_url, $current_datum);

// Schreibe CSV Dateien
file_put_contents('/var/www/vhosts/hosting144361.a2e8b.netcup.net/httpdocs/drossaviation/aip/at/heliports/php/../csv/airports-at-vfr.csv', $ad_2_csv_content);
//file_put_contents('/var/www/vhosts/hosting144361.a2e8b.netcup.net/httpdocs/drossaviation/aip/at/heliports/php/../csv/heliports-at-vfr.csv', $ad_3_csv_content);
?>
