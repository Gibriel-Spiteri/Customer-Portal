<?php
error_reporting(E_ALL);
ini_set('display_errors', '1');
ini_set('MAX_EXECUTION_TIME', '-1');
set_time_limit(0);
// Check if the user is already in Edge
require 'vendor/autoload.php';
include 'rest/jwt.php';


$jwtToken = $_GET['sso_token'] ?? null;
$name = null;
if ($jwtToken == null) {
	header("Location: https://1212804.app.netsuite.com/app/site/hosting/scriptlet.nl?script=4354&deploy=1");
	exit;
}

$userAgent = $_SERVER['HTTP_USER_AGENT'];
if (strpos($userAgent, 'Edg') === false) {
	// Redirect to Edge if not already in Edge
	header("Location: microsoft-edge:https://consumers.design/ike/1920x1080/index.php?sso_token=$jwtToken");
	exit;
}



// echo "<script> console.log('$jwtToken');</script>";
$decodedPayload = verifyToken($jwtToken);
// echo "<script> console.log(" . $decodedPayload[0] . implode($decodedPayload[1])  . ");</script>";
if (!$decodedPayload[0]) {
	header("HTTP/1.1 401 Unauthorized");
	// echo "<script> console.log(" . $decodedPayload[0] . implode($decodedPayload[1])  . ");</script>";
	exit;
}
$name = $decodedPayload[1]['name'];
// echo "<script> console.log('$name');</script>";


?>
<!DOCTYPE html>
<html lang="en">

<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Consumer Kitchen & Bath Specialists - 60 Second Kitchen Estimator</title>
	<meta name="description" content="Consumer Kitchen & Bath Specialists - 60 Second Kitchen Estimator">

	<link rel="icon" type="image/x-icon" href="/favicon.ico">
	<style>
		body {
			background-color: #014165;
			margin: 0;
			padding: 0;
			overflow: hidden;
		}
	</style>
	<script>
		function loadApp() {
			const url = 'https://consumers.design/ike/1920x1080/footage.php<?php echo "?user=$name"; ?>';
			const features = 'status=no,toolbar=no,location=no,menubar=no,directories=no,resizable=no,scrollbars=no,width=1920,height=1080';
			const newWindow = window.open(url, '_blank', features);

			// Attempt fullscreen if possible
			if (newWindow && newWindow.document.fullscreenEnabled) {
				newWindow.document.documentElement.requestFullscreen();
			}
			window.close();
		}

		window.onload = loadApp;
		// setTimeout(() => {}, 5000);
	</script>
</head>

<body>
</body>

</html>