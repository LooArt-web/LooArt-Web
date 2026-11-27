-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: looart1
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `archivos_referencia`
--

DROP TABLE IF EXISTS `archivos_referencia`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `archivos_referencia` (
  `id_archivo` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_personalizacion` bigint unsigned NOT NULL,
  `nombre_archivo` varchar(255) NOT NULL,
  `ruta` varchar(500) NOT NULL,
  `tipo_mime` varchar(100) NOT NULL,
  `tamano_bytes` bigint unsigned DEFAULT NULL,
  `creado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_archivo`),
  KEY `idx_archivo_personalizacion` (`id_personalizacion`),
  CONSTRAINT `fk_archivos_personalizacion` FOREIGN KEY (`id_personalizacion`) REFERENCES `personalizaciones` (`id_personalizacion`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `archivos_referencia`
--

LOCK TABLES `archivos_referencia` WRITE;
/*!40000 ALTER TABLE `archivos_referencia` DISABLE KEYS */;
/*!40000 ALTER TABLE `archivos_referencia` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categorias`
--

DROP TABLE IF EXISTS `categorias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categorias` (
  `id_categoria` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `descripcion` text,
  `activa` tinyint(1) NOT NULL DEFAULT '1',
  `creado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_categoria`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categorias`
--

LOCK TABLES `categorias` WRITE;
/*!40000 ALTER TABLE `categorias` DISABLE KEYS */;
/*!40000 ALTER TABLE `categorias` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `clientes`
--

DROP TABLE IF EXISTS `clientes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clientes` (
  `id_cliente` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(120) NOT NULL,
  `telefono` varchar(25) NOT NULL,
  `email` varchar(150) NOT NULL,
  `codigo_postal` char(5) NOT NULL,
  `creado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_cliente`),
  KEY `idx_cliente_email` (`email`),
  KEY `idx_cliente_telefono` (`telefono`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clientes`
--

LOCK TABLES `clientes` WRITE;
/*!40000 ALTER TABLE `clientes` DISABLE KEYS */;
/*!40000 ALTER TABLE `clientes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cotizaciones`
--

DROP TABLE IF EXISTS `cotizaciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cotizaciones` (
  `id_cotizacion` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_cliente` bigint unsigned NOT NULL,
  `folio` varchar(40) NOT NULL,
  `fecha_emision` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_vencimiento` date NOT NULL,
  `estatus` enum('NUEVA','EN_REVISION','ENVIADA','ACEPTADA','RECHAZADA','SUSTITUIDA','VENCIDA') NOT NULL DEFAULT 'NUEVA',
  `subtotal` decimal(12,2) NOT NULL DEFAULT '0.00',
  `costo_entrega` decimal(12,2) DEFAULT NULL,
  `total` decimal(12,2) NOT NULL DEFAULT '0.00',
  `moneda` char(3) NOT NULL DEFAULT 'MXN',
  `observaciones` text,
  `pdf_ruta` varchar(500) DEFAULT NULL,
  `creado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_cotizacion`),
  UNIQUE KEY `folio` (`folio`),
  KEY `idx_cotizacion_fecha` (`fecha_emision`),
  KEY `idx_cotizacion_estatus` (`estatus`),
  KEY `idx_cotizacion_cliente` (`id_cliente`),
  CONSTRAINT `fk_cotizaciones_clientes` FOREIGN KEY (`id_cliente`) REFERENCES `clientes` (`id_cliente`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_cotizacion_fechas` CHECK ((cast(`fecha_emision` as date) <= `fecha_vencimiento`)),
  CONSTRAINT `chk_cotizacion_importes` CHECK (((`subtotal` >= 0) and (`total` >= 0) and ((`costo_entrega` is null) or (`costo_entrega` >= 0))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cotizaciones`
--

LOCK TABLES `cotizaciones` WRITE;
/*!40000 ALTER TABLE `cotizaciones` DISABLE KEYS */;
/*!40000 ALTER TABLE `cotizaciones` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `detalle_cotizacion`
--

DROP TABLE IF EXISTS `detalle_cotizacion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `detalle_cotizacion` (
  `id_detalle` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_cotizacion` bigint unsigned NOT NULL,
  `id_variante` bigint unsigned NOT NULL,
  `cantidad` int unsigned NOT NULL,
  `precio_unitario_snapshot` decimal(12,2) NOT NULL,
  `subtotal` decimal(14,2) GENERATED ALWAYS AS ((`cantidad` * `precio_unitario_snapshot`)) STORED,
  `producto_snapshot` varchar(150) NOT NULL,
  `variante_snapshot` varchar(150) NOT NULL,
  `creado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_detalle`),
  KEY `idx_detalle_cotizacion` (`id_cotizacion`),
  KEY `idx_detalle_variante` (`id_variante`),
  CONSTRAINT `fk_detalle_cotizacion` FOREIGN KEY (`id_cotizacion`) REFERENCES `cotizaciones` (`id_cotizacion`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_detalle_variante` FOREIGN KEY (`id_variante`) REFERENCES `variantes` (`id_variante`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_detalle_cantidad` CHECK ((`cantidad` >= 1)),
  CONSTRAINT `chk_detalle_precio` CHECK ((`precio_unitario_snapshot` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `detalle_cotizacion`
--

LOCK TABLES `detalle_cotizacion` WRITE;
/*!40000 ALTER TABLE `detalle_cotizacion` DISABLE KEYS */;
/*!40000 ALTER TABLE `detalle_cotizacion` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `historial_estatus`
--

DROP TABLE IF EXISTS `historial_estatus`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `historial_estatus` (
  `id_historial` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_cotizacion` bigint unsigned NOT NULL,
  `id_usuario` bigint unsigned DEFAULT NULL,
  `estatus` enum('NUEVA','EN_REVISION','ENVIADA','ACEPTADA','RECHAZADA','SUSTITUIDA','VENCIDA') NOT NULL,
  `fecha_cambio` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `observacion` text,
  PRIMARY KEY (`id_historial`),
  KEY `fk_historial_usuario` (`id_usuario`),
  KEY `idx_historial_cotizacion_fecha` (`id_cotizacion`,`fecha_cambio`),
  CONSTRAINT `fk_historial_cotizacion` FOREIGN KEY (`id_cotizacion`) REFERENCES `cotizaciones` (`id_cotizacion`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_historial_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `historial_estatus`
--

LOCK TABLES `historial_estatus` WRITE;
/*!40000 ALTER TABLE `historial_estatus` DISABLE KEYS */;
/*!40000 ALTER TABLE `historial_estatus` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `personalizaciones`
--

DROP TABLE IF EXISTS `personalizaciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `personalizaciones` (
  `id_personalizacion` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_detalle` bigint unsigned NOT NULL,
  `tema` varchar(150) DEFAULT NULL,
  `descripcion` text,
  `texto_personalizado` varchar(500) DEFAULT NULL,
  `color` varchar(80) DEFAULT NULL,
  `presentacion_personalizada` varchar(150) DEFAULT NULL,
  `creado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_personalizacion`),
  UNIQUE KEY `id_detalle` (`id_detalle`),
  CONSTRAINT `fk_personalizaciones_detalle` FOREIGN KEY (`id_detalle`) REFERENCES `detalle_cotizacion` (`id_detalle`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personalizaciones`
--

LOCK TABLES `personalizaciones` WRITE;
/*!40000 ALTER TABLE `personalizaciones` DISABLE KEYS */;
/*!40000 ALTER TABLE `personalizaciones` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `precios`
--

DROP TABLE IF EXISTS `precios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `precios` (
  `id_precio` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_variante` bigint unsigned NOT NULL,
  `precio_unitario` decimal(12,2) NOT NULL,
  `cantidad_desde` int unsigned NOT NULL DEFAULT '1',
  `cantidad_hasta` int unsigned DEFAULT NULL,
  `vigente_desde` date NOT NULL,
  `vigente_hasta` date DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `creado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_precio`),
  KEY `idx_precio_busqueda` (`id_variante`,`activo`,`vigente_desde`,`vigente_hasta`,`cantidad_desde`,`cantidad_hasta`),
  CONSTRAINT `fk_precios_variantes` FOREIGN KEY (`id_variante`) REFERENCES `variantes` (`id_variante`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_precio_rango` CHECK (((`cantidad_desde` >= 1) and ((`cantidad_hasta` is null) or (`cantidad_hasta` >= `cantidad_desde`)))),
  CONSTRAINT `chk_precio_valor` CHECK ((`precio_unitario` >= 0)),
  CONSTRAINT `chk_precio_vigencia` CHECK (((`vigente_hasta` is null) or (`vigente_hasta` >= `vigente_desde`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `precios`
--

LOCK TABLES `precios` WRITE;
/*!40000 ALTER TABLE `precios` DISABLE KEYS */;
/*!40000 ALTER TABLE `precios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `productos`
--

DROP TABLE IF EXISTS `productos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productos` (
  `id_producto` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_categoria` bigint unsigned NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `descripcion` text,
  `imagen_principal` varchar(500) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `creado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_producto`),
  KEY `idx_producto_categoria_activo` (`id_categoria`,`activo`),
  CONSTRAINT `fk_productos_categorias` FOREIGN KEY (`id_categoria`) REFERENCES `categorias` (`id_categoria`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `productos`
--

LOCK TABLES `productos` WRITE;
/*!40000 ALTER TABLE `productos` DISABLE KEYS */;
/*!40000 ALTER TABLE `productos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id_rol` tinyint unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(30) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id_rol`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'COMPRADOR','Cliente que solicita cotizaciones; no requiere cuenta en el alcance actual.'),(2,'ADMINISTRADOR','Gestiona catalogo, precios y cotizaciones.'),(3,'SUPERUSUARIO','Administra usuarios y configuracion general.');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios` (
  `id_usuario` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_rol` tinyint unsigned NOT NULL,
  `nombre_usuario` varchar(60) NOT NULL,
  `correo` varchar(150) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `nombre_completo` varchar(120) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `ultimo_acceso` datetime DEFAULT NULL,
  `creado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `nombre_usuario` (`nombre_usuario`),
  UNIQUE KEY `correo` (`correo`),
  KEY `fk_usuarios_roles` (`id_rol`),
  CONSTRAINT `fk_usuarios_roles` FOREIGN KEY (`id_rol`) REFERENCES `roles` (`id_rol`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuarios`
--

LOCK TABLES `usuarios` WRITE;
/*!40000 ALTER TABLE `usuarios` DISABLE KEYS */;
/*!40000 ALTER TABLE `usuarios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `variantes`
--

DROP TABLE IF EXISTS `variantes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `variantes` (
  `id_variante` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_producto` bigint unsigned NOT NULL,
  `nombre` varchar(120) NOT NULL,
  `presentacion` varchar(120) DEFAULT NULL,
  `material` varchar(120) DEFAULT NULL,
  `cantidad_minima` int unsigned NOT NULL DEFAULT '1',
  `activa` tinyint(1) NOT NULL DEFAULT '1',
  `creado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_variante`),
  KEY `idx_variante_producto_activa` (`id_producto`,`activa`),
  CONSTRAINT `fk_variantes_productos` FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id_producto`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_variante_minimo` CHECK ((`cantidad_minima` >= 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `variantes`
--

LOCK TABLES `variantes` WRITE;
/*!40000 ALTER TABLE `variantes` DISABLE KEYS */;
/*!40000 ALTER TABLE `variantes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `vw_detalle_cotizaciones`
--

DROP TABLE IF EXISTS `vw_detalle_cotizaciones`;
/*!50001 DROP VIEW IF EXISTS `vw_detalle_cotizaciones`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `vw_detalle_cotizaciones` AS SELECT 
 1 AS `id_cotizacion`,
 1 AS `folio`,
 1 AS `fecha_emision`,
 1 AS `fecha_vencimiento`,
 1 AS `estatus`,
 1 AS `cliente`,
 1 AS `telefono`,
 1 AS `email`,
 1 AS `codigo_postal`,
 1 AS `id_detalle`,
 1 AS `producto_snapshot`,
 1 AS `variante_snapshot`,
 1 AS `cantidad`,
 1 AS `precio_unitario`,
 1 AS `subtotal_detalle`,
 1 AS `subtotal_cotizacion`,
 1 AS `costo_entrega`,
 1 AS `total`,
 1 AS `moneda`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `vw_resumen_cotizaciones`
--

DROP TABLE IF EXISTS `vw_resumen_cotizaciones`;
/*!50001 DROP VIEW IF EXISTS `vw_resumen_cotizaciones`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `vw_resumen_cotizaciones` AS SELECT 
 1 AS `producto_snapshot`,
 1 AS `variante_snapshot`,
 1 AS `numero_cotizaciones`,
 1 AS `unidades_cotizadas`,
 1 AS `importe_cotizado`*/;
SET character_set_client = @saved_cs_client;

--
-- Final view structure for view `vw_detalle_cotizaciones`
--

/*!50001 DROP VIEW IF EXISTS `vw_detalle_cotizaciones`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `vw_detalle_cotizaciones` AS select `c`.`id_cotizacion` AS `id_cotizacion`,`c`.`folio` AS `folio`,`c`.`fecha_emision` AS `fecha_emision`,`c`.`fecha_vencimiento` AS `fecha_vencimiento`,`c`.`estatus` AS `estatus`,`cl`.`nombre` AS `cliente`,`cl`.`telefono` AS `telefono`,`cl`.`email` AS `email`,`cl`.`codigo_postal` AS `codigo_postal`,`d`.`id_detalle` AS `id_detalle`,`d`.`producto_snapshot` AS `producto_snapshot`,`d`.`variante_snapshot` AS `variante_snapshot`,`d`.`cantidad` AS `cantidad`,`d`.`precio_unitario_snapshot` AS `precio_unitario`,`d`.`subtotal` AS `subtotal_detalle`,`c`.`subtotal` AS `subtotal_cotizacion`,`c`.`costo_entrega` AS `costo_entrega`,`c`.`total` AS `total`,`c`.`moneda` AS `moneda` from ((`cotizaciones` `c` join `clientes` `cl` on((`cl`.`id_cliente` = `c`.`id_cliente`))) join `detalle_cotizacion` `d` on((`d`.`id_cotizacion` = `c`.`id_cotizacion`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `vw_resumen_cotizaciones`
--

/*!50001 DROP VIEW IF EXISTS `vw_resumen_cotizaciones`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `vw_resumen_cotizaciones` AS select `detalle_cotizacion`.`producto_snapshot` AS `producto_snapshot`,`detalle_cotizacion`.`variante_snapshot` AS `variante_snapshot`,count(distinct `detalle_cotizacion`.`id_cotizacion`) AS `numero_cotizaciones`,sum(`detalle_cotizacion`.`cantidad`) AS `unidades_cotizadas`,sum(`detalle_cotizacion`.`subtotal`) AS `importe_cotizado` from `detalle_cotizacion` group by `detalle_cotizacion`.`producto_snapshot`,`detalle_cotizacion`.`variante_snapshot` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-25 22:10:09
