<?php
error_reporting(E_ALL);
ini_set('display_errors', '1');

// require '../vendor/autoload.php'; // Load the jwt-framework

use Jose\Component\Core\JWK;
use Jose\Component\Signature\JWSBuilder;
use Jose\Component\Signature\Algorithm\PS256;
use Jose\Component\Signature\Algorithm\HS256;
use Jose\Component\KeyManagement\JWKFactory;
use Jose\Component\Checker\HeaderCheckerManagerFactory;
use Jose\Component\Signature\Serializer\CompactSerializer;
use Jose\Component\Signature\JWSVerifier;
use Jose\Component\Core\AlgorithmManager;

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();
// 1. Define JWT header
function generateToken()
{

    $jwtHeader = [
        'alg' => 'PS256', // Algorithm PS256
        'typ' => 'JWT',   // JWT type
        'kid' =>  $_ENV['KID'] // Certificate Id (client credentials mapping)
    ];

    // 2. Define JWT payload
    $jwtPayload = [
        'iss' => $_ENV['CONSUMER_KEY'], // Consumer key of integration record
        'scope' => ['restlets', 'rest_webservices'],      // Scopes for integration record
        'iat' => time(),                                  // Issued at (current timestamp)
        'exp' => time() + 3600,                           // Expiration (1 hour from now)
        'aud' => 'https://1212804-SB1.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token'
    ];

    // 3. Load the private key (PEM file)
    $jwk = JWKFactory::createFromKeyFile('rest\key\sw2021d_key.pem', null, [
        'use' => 'sig'
    ]);

    // 4. Create JWS Builder
    $jwsBuilder = new JWSBuilder(new AlgorithmManager([
        new PS256()
    ]));

    // 5. Create JWS (JSON Web Signature) with PS256 algorithm
    $jws = $jwsBuilder
        ->create()                                     // Create new JWS
        ->withPayload(json_encode($jwtPayload))        // Set payload
        ->addSignature($jwk, ['alg' => 'PS256', 'typ' => 'JWT', 'kid' => $jwtHeader['kid']]) // Sign with PS256 and private key
        ->build();                                     // Build the JWS

    // 6. Serialize the JWS to compact format
    $serializer = new CompactSerializer(); // Compact JSON format
    $jwtToken = $serializer->serialize($jws, 0); // Serialize first signature

    // echo "JWT Token: " . $jwtToken;
    return $jwtToken;
}

// Function to verify JWT token
function verifyToken($jwtToken)
{
    echo "<script> console.log('In verifyToken');</script>";
    // 1. Load the secret key (string)
    $jwk = JWKFactory::createFromSecret(
        base64_decode($_ENV['SSO_SECRET']),
        [
            'kty' => 'oct'
        ]
    );
    echo "<script> console.log('jwk made');</script>";
    // 2. Create JWS Verifier
    $jwsVerifier = new JWSVerifier(new AlgorithmManager([
        new HS256()
    ]));
    echo "<script> console.log('jwsVerifier');</script>";
    // 3. Deserialize the JWS
    $serializer = new CompactSerializer();
    $jws = $serializer->unserialize($jwtToken);
    echo "<script> console.log('jws');</script>";
    // 4. Verify the JWS
    $isVerified = $jwsVerifier->verifyWithKey($jws, $jwk, 0);

    echo "<script> console.log('isVerified: " . var_export($isVerified, true) . "');</script>";
    // if ($isVerified) {
    // Decode the payload
    $payload = json_decode($jws->getPayload(), true);
    echo "<script> console.log('" . json_encode($payload) . "');</script>";
    return [true, $payload];
    // } else {
    //     return [false, null];
    // }
}
