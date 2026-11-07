-- Invented test data in cmangos classic-db's dump layout (WEB-90): only the tables and columns the import reads.
CREATE TABLE `creature` (
  `guid` int unsigned NOT NULL AUTO_INCREMENT,
  `id` mediumint unsigned NOT NULL DEFAULT '0',
  `map` smallint unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`guid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;
INSERT INTO `creature` VALUES (1,7001,229),(2,7101,0),(3,7102,0),(4,7103,0),(5,7104,0),(6,7002,0),(7,7201,36);
CREATE TABLE `creature_loot_template` (
  `entry` mediumint unsigned NOT NULL DEFAULT '0',
  `item` mediumint unsigned NOT NULL DEFAULT '0',
  `ChanceOrQuestChance` float NOT NULL DEFAULT '100',
  `groupid` tinyint unsigned NOT NULL DEFAULT '0',
  `mincountOrRef` mediumint NOT NULL DEFAULT '1',
  `maxcount` tinyint unsigned NOT NULL DEFAULT '1',
  `condition_id` mediumint unsigned NOT NULL DEFAULT '0',
  `comments` varchar(300) DEFAULT '',
  PRIMARY KEY (`entry`,`item`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;
INSERT INTO `creature_loot_template` VALUES (7001,50001,100,0,-50001,1,0,'Test reference'),(7001,5002,30,0,1,2,0,'Test Thread'),(7101,50002,1,0,-50002,1,0,''),(7102,50002,1,0,-50002,1,0,''),(7103,50002,1,0,-50002,1,0,''),(7104,50002,1,0,-50002,1,0,''),(7201,5003,25,0,1,1,0,'Test Shirt Item'),(7201,5004,0.5,0,1,1,0,'Test Robe Item');
CREATE TABLE `creature_template` (
  `Entry` mediumint unsigned NOT NULL DEFAULT '0',
  `Name` char(100) NOT NULL DEFAULT '',
  `LootId` mediumint unsigned NOT NULL DEFAULT '0',
  `VendorTemplateId` mediumint unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`Entry`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;
INSERT INTO `creature_template` VALUES (7001,'Test Boss',7001,0),(7002,'Test Quartermaster',0,0),(7003,'Test Merchant',0,0),(7004,'Test Peddler',0,40),(7101,'Test Wolf',7101,0),(7102,'Test Wolf Pup',7102,0),(7103,'Test Wolf Elder',7103,0),(7104,'Test Wolf\'s Mother',7104,0),(7201,'Test Deadmines Boss',7201,0);
CREATE TABLE `gameobject` (
  `guid` int unsigned NOT NULL AUTO_INCREMENT,
  `id` mediumint unsigned NOT NULL DEFAULT '0',
  `map` smallint unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`guid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;
CREATE TABLE `gameobject_loot_template` (
  `entry` mediumint unsigned NOT NULL DEFAULT '0',
  `item` mediumint unsigned NOT NULL DEFAULT '0',
  `ChanceOrQuestChance` float NOT NULL DEFAULT '100',
  `groupid` tinyint unsigned NOT NULL DEFAULT '0',
  `mincountOrRef` mediumint NOT NULL DEFAULT '1',
  `maxcount` tinyint unsigned NOT NULL DEFAULT '1',
  `condition_id` mediumint unsigned NOT NULL DEFAULT '0',
  `comments` varchar(300) DEFAULT '',
  PRIMARY KEY (`entry`,`item`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;
CREATE TABLE `gameobject_template` (
  `entry` mediumint unsigned NOT NULL DEFAULT '0',
  `type` tinyint unsigned NOT NULL DEFAULT '0',
  `name` varchar(100) NOT NULL DEFAULT '',
  `data1` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`entry`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;
CREATE TABLE `item_loot_template` (
  `entry` mediumint unsigned NOT NULL DEFAULT '0',
  `item` mediumint unsigned NOT NULL DEFAULT '0',
  `ChanceOrQuestChance` float NOT NULL DEFAULT '100',
  `groupid` tinyint unsigned NOT NULL DEFAULT '0',
  `mincountOrRef` mediumint NOT NULL DEFAULT '1',
  `maxcount` tinyint unsigned NOT NULL DEFAULT '1',
  `condition_id` mediumint unsigned NOT NULL DEFAULT '0',
  `comments` varchar(300) DEFAULT '',
  PRIMARY KEY (`entry`,`item`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;
CREATE TABLE `item_template` (
  `entry` mediumint unsigned NOT NULL DEFAULT '0',
  `class` tinyint unsigned NOT NULL DEFAULT '0',
  `subclass` tinyint unsigned NOT NULL DEFAULT '0',
  `name` varchar(255) NOT NULL DEFAULT '',
  `Quality` tinyint unsigned NOT NULL DEFAULT '0',
  `InventoryType` tinyint unsigned NOT NULL DEFAULT '0',
  `ItemLevel` tinyint unsigned NOT NULL DEFAULT '0',
  `RequiredLevel` tinyint unsigned NOT NULL DEFAULT '0',
  `RequiredSkillRank` smallint unsigned NOT NULL DEFAULT '0',
  `RequiredReputationFaction` smallint unsigned NOT NULL DEFAULT '0',
  `RequiredReputationRank` smallint unsigned NOT NULL DEFAULT '0',
  `stackable` smallint unsigned NOT NULL DEFAULT '1',
  `stat_type1` tinyint unsigned NOT NULL DEFAULT '0',
  `stat_value1` smallint NOT NULL DEFAULT '0',
  `stat_type2` tinyint unsigned NOT NULL DEFAULT '0',
  `stat_value2` smallint NOT NULL DEFAULT '0',
  `dmg_min1` float NOT NULL DEFAULT '0',
  `dmg_max1` float NOT NULL DEFAULT '0',
  `dmg_type1` tinyint unsigned NOT NULL DEFAULT '0',
  `armor` smallint unsigned NOT NULL DEFAULT '0',
  `fire_res` tinyint unsigned NOT NULL DEFAULT '0',
  `delay` smallint unsigned NOT NULL DEFAULT '1000',
  `spellid_1` mediumint unsigned NOT NULL DEFAULT '0',
  `spelltrigger_1` tinyint unsigned NOT NULL DEFAULT '0',
  `spellcooldown_1` int NOT NULL DEFAULT '-1',
  `spellid_2` mediumint unsigned NOT NULL DEFAULT '0',
  `spelltrigger_2` tinyint unsigned NOT NULL DEFAULT '0',
  `spellcooldown_2` int NOT NULL DEFAULT '-1',
  `bonding` tinyint unsigned NOT NULL DEFAULT '0',
  `description` varchar(255) NOT NULL DEFAULT '',
  `MaxDurability` smallint unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`entry`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;
INSERT INTO `item_template` VALUES (5003,4,1,'Test Shirt Item',2,4,12,5,0,0,0,1,5,3,0,0,0,0,0,10,0,0,0,0,-1,0,0,-1,2,'',30),(5004,4,1,'Test Robe Item',4,20,60,55,0,0,0,1,5,12,6,-4,0,0,0,50,5,0,0,0,-1,0,0,-1,1,'',80),(5008,4,1,'Test Pants Item',3,7,45,40,0,0,0,1,0,0,0,0,0,0,0,30,0,0,0,0,-1,0,0,-1,2,'',60),(5010,2,7,'Test Sword',2,13,30,25,0,0,0,1,0,0,0,0,10,20,0,0,0,2600,9201,1,-1,0,0,-1,2,'A \'test\' sword.',75),(6003,9,2,'Pattern: Test Robe',3,0,60,0,75,0,0,1,0,0,0,0,0,0,0,0,0,0,483,0,-1,9103,0,-1,1,'',0),(6004,9,2,'Pattern: Test Gloves',3,0,58,0,105,59,5,1,0,0,0,0,0,0,0,0,0,0,9104,0,-1,0,0,-1,1,'',0),(6005,9,2,'Pattern: Test Bag',2,0,40,0,65,0,0,1,0,0,0,0,0,0,0,0,0,0,9105,0,-1,0,0,-1,0,'',0),(6006,9,2,'Pattern: Test Cloak',2,0,30,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,9106,0,-1,0,0,-1,0,'',0),(6007,9,2,'Pattern: Test Pants',3,0,45,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,9107,0,-1,0,0,-1,1,'',0);
CREATE TABLE `npc_trainer` (
  `entry` mediumint unsigned NOT NULL DEFAULT '0',
  `spell` mediumint unsigned NOT NULL DEFAULT '0',
  `spellcost` int unsigned NOT NULL DEFAULT '0',
  `reqskill` smallint unsigned NOT NULL DEFAULT '0',
  `reqskillvalue` smallint unsigned NOT NULL DEFAULT '0',
  `reqlevel` tinyint unsigned NOT NULL DEFAULT '0',
  `ReqAbility1` int unsigned DEFAULT NULL,
  UNIQUE KEY `entry_spell` (`entry`,`spell`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;
INSERT INTO `npc_trainer` VALUES (8001,9101,500,197,50,0,NULL),(8001,9109,900,333,0,0,NULL),(8002,9101,500,197,55,0,NULL);
CREATE TABLE `npc_trainer_template` (
  `entry` mediumint unsigned NOT NULL DEFAULT '0',
  `spell` mediumint unsigned NOT NULL DEFAULT '0',
  `spellcost` int unsigned NOT NULL DEFAULT '0',
  `reqskill` smallint unsigned NOT NULL DEFAULT '0',
  `reqskillvalue` smallint unsigned NOT NULL DEFAULT '0',
  `reqlevel` tinyint unsigned NOT NULL DEFAULT '0',
  `ReqAbility1` int unsigned DEFAULT NULL,
  UNIQUE KEY `entry_spell` (`entry`,`spell`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;
INSERT INTO `npc_trainer_template` VALUES (1,9101,500,197,50,0,NULL);
CREATE TABLE `npc_vendor` (
  `entry` mediumint unsigned NOT NULL DEFAULT '0',
  `item` mediumint unsigned NOT NULL DEFAULT '0',
  `maxcount` tinyint unsigned NOT NULL DEFAULT '0',
  `incrtime` int unsigned NOT NULL DEFAULT '0',
  `slot` tinyint unsigned NOT NULL DEFAULT '0',
  `condition_id` int unsigned NOT NULL DEFAULT '0',
  `comments` mediumtext,
  PRIMARY KEY (`entry`,`item`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;
INSERT INTO `npc_vendor` VALUES (7002,6004,0,0,0,0,'Pattern: Test Gloves'),(7003,6005,1,9000,0,0,'Pattern: Test Bag');
CREATE TABLE `npc_vendor_template` (
  `entry` mediumint unsigned NOT NULL DEFAULT '0',
  `item` mediumint unsigned NOT NULL DEFAULT '0',
  `maxcount` tinyint unsigned NOT NULL DEFAULT '0',
  `incrtime` int unsigned NOT NULL DEFAULT '0',
  `slot` tinyint unsigned NOT NULL DEFAULT '0',
  `condition_id` int unsigned NOT NULL DEFAULT '0',
  `comments` mediumtext,
  PRIMARY KEY (`entry`,`item`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;
INSERT INTO `npc_vendor_template` VALUES (40,6006,0,0,0,0,'Pattern: Test Cloak');
CREATE TABLE `quest_template` (
  `entry` mediumint unsigned NOT NULL DEFAULT '0',
  `Title` text,
  `RewItemId1` mediumint unsigned NOT NULL DEFAULT '0',
  `RewChoiceItemId1` mediumint unsigned NOT NULL DEFAULT '0',
  `RewSpell` int unsigned NOT NULL DEFAULT '0',
  `RewSpellCast` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`entry`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;
INSERT INTO `quest_template` VALUES (3001,'A Test Quest',6006,0,0,0),(3002,'Another Test, With a Comma',0,0,0,9109);
CREATE TABLE `reference_loot_template` (
  `entry` mediumint unsigned NOT NULL DEFAULT '0',
  `item` mediumint unsigned NOT NULL DEFAULT '0',
  `ChanceOrQuestChance` float NOT NULL DEFAULT '100',
  `groupid` tinyint unsigned NOT NULL DEFAULT '0',
  `mincountOrRef` mediumint NOT NULL DEFAULT '1',
  `maxcount` tinyint unsigned NOT NULL DEFAULT '1',
  `condition_id` mediumint unsigned NOT NULL DEFAULT '0',
  `comments` varchar(300) DEFAULT '',
  PRIMARY KEY (`entry`,`item`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;
INSERT INTO `reference_loot_template` VALUES (50001,6003,5,1,1,1,0,'Pattern: Test Robe'),(50002,50003,100,0,-50003,1,0,'nested'),(50003,6007,0.1,0,1,1,0,'Pattern: Test Pants');
