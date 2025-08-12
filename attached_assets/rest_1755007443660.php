<?php
error_reporting(E_ALL);
ini_set('display_errors', '1');

include 'jwt.php';

function getAccessToken()
{
    try {
        $clientAssertion = generateToken();
        // print_r($clientAssertion);
        $curl = curl_init();

        curl_setopt_array($curl, array(
            CURLOPT_URL => 'https://1212804.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_ENCODING => '',
            CURLOPT_MAXREDIRS => 10,
            CURLOPT_TIMEOUT => 0,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_CUSTOMREQUEST => 'POST',
            CURLOPT_POSTFIELDS => "grant_type=client_credentials&client_assertion_type=urn%3Aietf%3Aparams%3Aoauth%3Aclient-assertion-type%3Ajwt-bearer&client_assertion=$clientAssertion",
            CURLOPT_HTTPHEADER => array(
                'Content-Type: application/x-www-form-urlencoded'
                // 'Cookie: _abck=01E821F6A43360C51C25B7175364728C~-1~YAAQi2jcFyjNuTSSAQAAZIzaTQyLq9FF/ho3H/OppnQvuDkJNWi51D/dI8CCnBL2uJDDzyBUlYkq4EeO3gxDIadBR8Wc3nCorhvpDuWDLiwUtB2nirSQTHDgzLgT/9ZXdYYJdK437Y4eHcrHZIppipZ2qvBKmSE8pbDY09vaBOatscj4RXneasHk3agx5WvXZJcRt2G2ZMa30azZuwTtyX3TOABylxKAQFsKMddyUrl2I/n1+qtstw672gLE8L7LTXVl3VZw48DAzAOugI34YnuBpX49MWt+XqIs59oCpltaMmyJYdTlfyywgZXP2yIPUMn7kKB41/n82ZQ3kZiejxoXzLZROZNnW5RwmoTx5QiwdXggn7aZY6GkfdudUhEyeTqGmkZ467wxfymaNOTVckRA3RFqx7feBare8A==~-1~-1~-1'
            ),
        ));

        $response = curl_exec($curl);
        // print_r("errno" . curl_errno($curl));
        // print_r("curl error" . curl_error($curl));
        // print_r($response);
        curl_close($curl);
        $token = "Bearer " . json_decode($response, true)['access_token'];
        return $token;
    } catch (\Throwable $th) {
        print_r($th);
    }
}

function sendQuery($accesstoken, $query, $limit, $offset)
{
    $curl = curl_init();

    curl_setopt_array($curl, array(
        CURLOPT_URL => "https://1212804.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=$limit&offset=$offset",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_CUSTOMREQUEST => 'POST',
        CURLOPT_POSTFIELDS => $query,
        CURLOPT_HTTPHEADER => array(
            'Prefer: transient',
            'Content-Type: application/json',
            "Authorization: $accesstoken"
            // 'Cookie: _abck=01E821F6A43360C51C25B7175364728C~-1~YAAQi2jcFyjNuTSSAQAAZIzaTQyLq9FF/ho3H/OppnQvuDkJNWi51D/dI8CCnBL2uJDDzyBUlYkq4EeO3gxDIadBR8Wc3nCorhvpDuWDLiwUtB2nirSQTHDgzLgT/9ZXdYYJdK437Y4eHcrHZIppipZ2qvBKmSE8pbDY09vaBOatscj4RXneasHk3agx5WvXZJcRt2G2ZMa30azZuwTtyX3TOABylxKAQFsKMddyUrl2I/n1+qtstw672gLE8L7LTXVl3VZw48DAzAOugI34YnuBpX49MWt+XqIs59oCpltaMmyJYdTlfyywgZXP2yIPUMn7kKB41/n82ZQ3kZiejxoXzLZROZNnW5RwmoTx5QiwdXggn7aZY6GkfdudUhEyeTqGmkZ467wxfymaNOTVckRA3RFqx7feBare8A==~-1~-1~-1'
        ),
    ));

    $response = curl_exec($curl);

    curl_close($curl);
    echo $response;
    return $response;
}

// doorstyle.custrecord_cds_species_adjustment_percen AS speciesadjustmentpercent,
//doorstyle.custrecord_cds_door_species AS doorspecies,
function getDoorStyles($accesstoken, $limit, $offset)
{
    $querystr = "SELECT doorstyle.name AS stylename,
    doorstyle.custrecord_cabdoorstyle_imgurl AS imageurl,
    BUILTIN.DF(doorstyle.custrecord_cabdoorstyle_prodline) AS prodline,
    doorstyle.custrecord_cabdoorstyle_prodline AS prodlineid,
    doorstyle.recordid AS cdsid,
    doorstyle.custrecord_cabdoorstyle_pricebookcol AS pricebookcol,
    BUILTIN.DF(doorstyle.custrecord_cbs_60se_species) AS doorspecies,
    doorstyle.custrecord_cds_door_species AS cdsspecies,
    doorstyle.custrecord_cds_doordwrconst_features AS constructionfeatures,
    BUILTIN.DF(doorstyle.custrecord_cds_doorpanel) AS doorpanel,
    doorstyle.custrecord_cds_ppf_84 AS priceperfoot84,
    doorstyle.custrecord_cds_ppf_84m AS priceperfoot84m,
    doorstyle.custrecord_cds_ppf_90 AS priceperfoot90,
    doorstyle.custrecord_cds_ppf_90m AS priceperfoot90m,
    doorstyle.custrecord_cds_price_adjustment_species AS speciesadjustment,
    doorstyle.custrecord_cds_price_adjustment_paint AS paintadjustment,
    doorstyle.custrecord_cds_available_painted AS painted,
    doorstyle.custrecord_cds_available_stained AS stained,
    doorstyle.custrecord_cds_available_lam_acry AS acrylic,
    doorstyle.custrecord_cabdoorstyle_disable AS isdisabled,
    doorstyle.custrecord_cds_image_varied_species AS isvaried,
    doorstyle.isinactive AS isinactive
    FROM customrecord_cabdoorstyle doorstyle
    WHERE doorstyle.custrecord_cabdoorstyle_pricebookcol IS NOT NULL
    AND doorstyle.custrecord_cabdoorstyle_disable = 'T'
    AND doorstyle.isinactive = 'F'
    ";
    $sanitizedstr = str_replace("\n", "", $querystr);
    $sanitizedstr = str_replace("\t", "", $sanitizedstr);
    $sanitizedstr = str_replace("\r", "", $sanitizedstr);
    $query = json_decode(json_encode("{\"q\": \"$sanitizedstr\"}"));
    print_r($query);
    return sendQuery($accesstoken, $query, $limit, $offset);
}

function getPLDoorStyles($prodline, $accesstoken, $limit, $offset)
{
    $querystr = "SELECT doorstyle.name AS stylename,
    doorstyle.custrecord_cabdoorstyle_imgurl AS imageurl,
    BUILTIN.DF(doorstyle.custrecord_cabdoorstyle_prodline) AS prodline,
    doorstyle.custrecord_cabdoorstyle_prodline AS prodlineid,
    doorstyle.custrecord_cabdoorstyle_pricebookcol AS pricebookcol,
    BUILTIN.DF(doorstyle.custrecord_cbs_60se_species) AS doorspecies,
    doorstyle.custrecord_cds_doordwrconst_features AS constructionfeatures,
    BUILTIN.DF(doorstyle.custrecord_cds_doorpanel) AS doorpanel,
    doorstyle.custrecord_cds_ppf_84 AS priceperfoot84,
    doorstyle.custrecord_cds_ppf_84m AS priceperfoot84m,
    doorstyle.custrecord_cds_ppf_90 AS priceperfoot90,
    doorstyle.custrecord_cds_ppf_90m AS priceperfoot90m,
    doorstyle.custrecord_cds_price_adjustment_species AS speciesadjustment,
    doorstyle.custrecord_cds_price_adjustment_paint AS paintadjustment,
    doorstyle.custrecord_cds_available_painted AS painted,
    doorstyle.custrecord_cds_available_stained AS stained,
    doorstyle.custrecord_cds_available_lam_acry AS acrylic,
    doorstyle.custrecord_cabdoorstyle_disable AS isdisabled,
    doorstyle.custrecord_cds_image_varied_species AS isvaried,
    doorstyle.isinactive AS isinactive
    FROM customrecord_cabdoorstyle doorstyle
    WHERE doorstyle.custrecord_cabdoorstyle_pricebookcol IS NOT NULL
    AND doorstyle.custrecord_cabdoorstyle_prodline = $prodline
    AND doorstyle.custrecord_cabdoorstyle_disable = 'T'
    AND doorstyle.isinactive = 'F'
    ";
    $sanitizedstr = str_replace("\n", "", $querystr);
    $sanitizedstr = str_replace("\t", "", $sanitizedstr);
    $sanitizedstr = str_replace("\r", "", $sanitizedstr);
    $query = json_decode(json_encode("{\"q\": \"$sanitizedstr\"}"));
    // print_r($query);
    return sendQuery($accesstoken, $query, $limit, $offset);
}

function getAfpCabinets($accesstoken, $limit, $offset)
{
    // $querystr = "SELECT
    //                 cabinet.custrecord_afp_layout AS AFPLayout,
    //                 cabinet.name AS CabinetName,
    //                 cabinet.custrecord_afp_cabinet_retail_price AS TotalRetailPrice,
    //                 layout.custrecord_afp_layout_linear_feet AS TotalLinearFeet,
    //                 ROUND(SUM(cabinet.custrecord_afp_cabinet_retail_price) / SUM(layout.custrecord_afp_layout_linear_feet), 2) AS PricePerFoot
    //             FROM
    //                 customrecord_afp_cabinet_layout layout
    //             JOIN
    //                 customrecord_afp_cabinet cabinet ON cabinet.custrecord_afp_cabinet_layout = 993
    //             GROUP BY
    //                 cabinet.custrecord_afp_layout,
    //                 cabinet.name,
    //                 cabinet.custrecord_afp_cabinet_retail_price,
    //                 layout.custrecord_afp_layout_linear_feet";

    $querystr = "SELECT *
                    FROM customrecord_afp_cabinet cabinet";
    // WHERE BUILTIN.MNFILTER( cabinet.custrecord_afp_cabinet_layout, 'MN_INCLUDE', '', 'TRUE', '1' ) = 'T'";

    $sanitizedstr = str_replace("\n", "", $querystr);
    $sanitizedstr = str_replace("\t", "", $sanitizedstr);
    $sanitizedstr = str_replace("\r", "", $sanitizedstr);
    $query = json_decode(json_encode("{\"q\": \"$sanitizedstr\"}"));

    return sendQuery($accesstoken, $query, $limit, $offset);
}
// WHERE
// pricing.cabinet_style_id = :cabinetStyleID

function getAfpLayouts($accesstoken, $limit, $offset)
{
    $querystr = "SELECT *
                    FROM customrecord_afplayout layout
                    WHERE layout.isinactive = 'F'";

    $sanitizedstr = str_replace("\n", "", $querystr);
    $sanitizedstr = str_replace("\t", "", $sanitizedstr);
    $sanitizedstr = str_replace("\r", "", $sanitizedstr);
    $query = json_decode(json_encode("{\"q\": \"$sanitizedstr\"}"));

    return sendQuery($accesstoken, $query, $limit, $offset);
}

function getProdlineImages($accesstoken, $limit, $offset)
{
    $querystr = "SELECT pl.custrecord_pl_60se_logo_url AS imageurl,
                        pl.custrecord_pl_60se_logo_placement AS placement,
                        pl.custrecord_pl_prd_leadtime_current_weeks AS leadtime,
                        pl.name AS prodline,
                        pl.id AS prodlineid
                FROM customrecord_pl pl
                WHERE pl.custrecord_pl_60se_logo_url IS NOT NULL";

    $sanitizedstr = str_replace("\n", "", $querystr);
    $sanitizedstr = str_replace("\t", "", $sanitizedstr);
    $sanitizedstr = str_replace("\r", "", $sanitizedstr);
    $query = json_decode(json_encode("{\"q\": \"$sanitizedstr\"}"));

    return sendQuery($accesstoken, $query, $limit, $offset);
}

function getCabbuildValues($accesstoken, $cabbuildid)
{
    $querystr = "SELECT cabbuild.custrecord_cabbuild_projectprice AS projprice,
                FROM customrecord_cabbuild cabbuild
                WHERE cabbuild.isinactive = 'F'
                AND cabbuild.internalid = $cabbuildid";

    $sanitizedstr = str_replace("\n", "", $querystr);
    $sanitizedstr = str_replace("\t", "", $sanitizedstr);
    $sanitizedstr = str_replace("\r", "", $sanitizedstr);
    $query = json_decode(json_encode("{\"q\": \"$sanitizedstr\"}"));

    return sendQuery($accesstoken, $query, 1, 0);
}

function getCabSectionValues($accesstoken, $cabbuildid)
{
    $querystr = "SELECT cabsec.custrecord_cabsection_cds AS cds,
                FROM customrecord_cabsection cabsec
                WHERE cabsec.custrecord_cabsection_cabbuild = $cabbuildid";

    $sanitizedstr = str_replace("\n", "", $querystr);
    $sanitizedstr = str_replace("\t", "", $sanitizedstr);
    $sanitizedstr = str_replace("\r", "", $sanitizedstr);
    $query = json_decode(json_encode("{\"q\": \"$sanitizedstr\"}"));

    return sendQuery($accesstoken, $query, 1, 0);
}

function getCDSValues($accesstoken, $cabbuildid)
{
    $querystr = "SELECT cabsec.custrecord_cabsection_cds AS cds,
                FROM customrecord_cabsection cabsec
                WHERE cabsec.custrecord_cabsection_cabbuild = $cabbuildid";

    $sanitizedstr = str_replace("\n", "", $querystr);
    $sanitizedstr = str_replace("\t", "", $sanitizedstr);
    $sanitizedstr = str_replace("\r", "", $sanitizedstr);
    $query = json_decode(json_encode("{\"q\": \"$sanitizedstr\"}"));

    return sendQuery($accesstoken, $query, 1, 0);
}