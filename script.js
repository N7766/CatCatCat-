/**
 * 猫咪钓鱼点击游戏 - 完整版本
 * 包含：多种升级、成就系统、重置机制
 * 使用 IIFE 模式避免全局污染
 */
(function() {
    'use strict';

    // ==================== 游戏平衡配置 ====================
    const GameConfig = {
        // 成本增长公式配置
        // 基础成本 * (成本倍率 ^ 等级) - 指数增长
        COST_BASE_MULTIPLIER: 1.5,  // 基础倍率（可调整）
        
        // 转生系统配置
        PRESTIGE_FISH_REQUIREMENT: 10000,  // 转生所需的最低鱼数
        PRESTIGE_BONUS_PER_LEVEL: 0.05,    // 每级转生加成（5%）
        PRESTIGE_COST_MULTIPLIER: 2.0,     // 转生等级成本倍率
        
        // 暴击系统配置
        CRIT_BASE_CHANCE: 0.05,            // 基础暴击率（5%）
        CRIT_CHANCE_PER_LEVEL: 0.02,       // 每级增加的暴击率（2%）
        CRIT_MIN_MULTIPLIER: 2.0,          // 最小暴击倍率（2x）
        CRIT_MAX_MULTIPLIER: 5.0,          // 最大暴击倍率（5x）
        
        // 里程碑配置
        MILESTONES: [100, 1000, 10000, 100000, 1000000]
    };

    // ==================== 游戏状态管理 ====================
    const GameState = {
        fish: 0,                    // 当前鱼鱼数量
        totalFishEarned: 0,         // 累计获得的鱼（用于成就）
        fishPerClick: 1,            // 基础每次点击获得的鱼鱼
        prestigeLevel: 0,           // 转生等级
        prestigeBonus: 0,           // 转生永久加成（倍数，如0.1表示+10%）
        globalMultiplier: 1.0,      // 全局倍率（来自猫猫伙伴）
        unlockedAchievements: new Set(),  // 已解锁的成就
        
        upgrades: {
            // 强化鱼竿：增加每次点击的基础值
            clickPower: {
                level: 0,
                baseCost: 10,
                name: '🎣 强化鱼竿',
                description: '提升每次点击的基础收益',
                icon: '🎣',
                // 成本公式：基础成本 * (1.5 ^ 等级)
                getCost: function(level) {
                    return Math.floor(this.baseCost * Math.pow(GameConfig.COST_BASE_MULTIPLIER, level));
                },
                // 效果：每级增加1点基础点击值
                getEffect: function(level) {
                    return level;
                }
            },
            
            // 自动钓鱼：每秒自动获得鱼
            autoFishing: {
                level: 0,
                baseCost: 50,
                name: '🤖 自动钓鱼助手',
                description: '每秒自动获得鱼鱼',
                icon: '🤖',
                interval: 1000,  // 自动钓鱼间隔（毫秒）
                // 成本公式：基础成本 * (1.5 ^ 等级)
                getCost: function(level) {
                    return Math.floor(this.baseCost * Math.pow(GameConfig.COST_BASE_MULTIPLIER, level));
                },
                // 效果：每级每秒增加1条鱼
                getEffect: function(level) {
                    return level;
                }
            },
            
            // 幸运小鱼干：增加暴击概率和倍率
            luckyFish: {
                level: 0,
                baseCost: 100,
                name: '🍀 幸运小鱼干',
                description: '增加暴击概率和伤害倍率',
                icon: '🍀',
                // 成本公式：基础成本 * (1.5 ^ 等级)
                getCost: function(level) {
                    return Math.floor(this.baseCost * Math.pow(GameConfig.COST_BASE_MULTIPLIER, level));
                },
                // 暴击概率：基础5% + 每级2%
                getCritChance: function(level) {
                    return GameConfig.CRIT_BASE_CHANCE + (level * GameConfig.CRIT_CHANCE_PER_LEVEL);
                },
                // 暴击倍率：2x ~ 5x（随等级提升最小倍率）
                getCritMultiplier: function(level) {
                    const minMultiplier = Math.min(
                        GameConfig.CRIT_MIN_MULTIPLIER + (level * 0.1),
                        GameConfig.CRIT_MAX_MULTIPLIER
                    );
                    return minMultiplier + Math.random() * (GameConfig.CRIT_MAX_MULTIPLIER - minMultiplier);
                }
            },
            
            // 猫猫伙伴：全局倍率加成
            catCompanion: {
                level: 0,
                baseCost: 500,
                name: '🐱 猫猫伙伴',
                description: '全局收益倍率加成',
                icon: '🐱',
                // 成本公式：基础成本 * (1.5 ^ 等级) - 更昂贵
                getCost: function(level) {
                    return Math.floor(this.baseCost * Math.pow(GameConfig.COST_BASE_MULTIPLIER, level));
                },
                // 效果：每级增加10%全局倍率（1.1x, 1.2x, 1.3x...）
                getMultiplier: function(level) {
                    return 1.0 + (level * 0.1);
                }
            }
        },
        
        autoFishingActive: false,   // 自动钓鱼是否激活
        muted: false                // 是否静音
    };

    // ==================== DOM 元素引用 ====================
    const elements = {
        fishCount: document.getElementById('fish-count'),
        fishPerClick: document.getElementById('fish-per-click'),
        fishPerSecond: document.getElementById('fish-per-second'),
        prestigeBonus: document.getElementById('prestige-bonus'),
        prestigeBonusItem: document.getElementById('prestige-bonus-item'),
        prestigeBtn: document.getElementById('prestige-btn'),
        cat: document.getElementById('cat'),
        floatingTexts: document.getElementById('floating-texts'),
        upgradesList: document.getElementById('upgrades-list'),
        muteBtn: document.getElementById('mute-btn'),
        fishingRod: document.getElementById('fishing-rod'),
        rodHook: document.getElementById('rod-hook'),
        fishAnimationContainer: document.getElementById('fish-animation-container'),
        achievementsBtn: document.getElementById('achievements-btn'),
        achievementsPanel: document.getElementById('achievements-panel'),
        achievementsList: document.getElementById('achievements-list'),
        closeAchievements: document.getElementById('close-achievements')
    };

    // ==================== 升级成本计算公式 ====================
    const UpgradeCalculator = {
        /**
         * 计算升级成本（指数增长）
         * @param {Object} upgrade - 升级对象
         * @param {number} currentLevel - 当前等级
         * @returns {number} 下一级成本
         */
        calculateCost(upgrade, currentLevel) {
            return upgrade.getCost(currentLevel);
        },
        
        /**
         * 计算实际点击收益（包含所有加成）
         * @returns {number} 实际每次点击获得的鱼
         */
        calculateActualClickValue() {
            const baseClickPower = 1 + GameState.upgrades.clickPower.getEffect(GameState.upgrades.clickPower.level);
            const globalMultiplier = GameState.globalMultiplier;
            const prestigeMultiplier = 1.0 + GameState.prestigeBonus;
            return baseClickPower * globalMultiplier * prestigeMultiplier;
        },
        
        /**
         * 计算实际每秒收益
         * @returns {number} 实际每秒获得的鱼
         */
        calculateActualPerSecond() {
            const baseAutoFishing = GameState.upgrades.autoFishing.getEffect(GameState.upgrades.autoFishing.level);
            const globalMultiplier = GameState.globalMultiplier;
            const prestigeMultiplier = 1.0 + GameState.prestigeBonus;
            return baseAutoFishing * globalMultiplier * prestigeMultiplier;
        }
    };

    // ==================== 音效系统 ====================
    const SoundManager = {
        audioContext: null,
        
        init() {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('音频上下文初始化失败:', e);
            }
        },

        playClickSound() {
            if (GameState.muted || !this.audioContext) return;
            try {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.1);
            } catch (e) {
                console.warn('播放音效失败:', e);
            }
        },

        playUpgradeSound() {
            if (GameState.muted || !this.audioContext) return;
            try {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.2);
                gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.2);
            } catch (e) {
                console.warn('播放音效失败:', e);
            }
        },
        
        playCritSound() {
            if (GameState.muted || !this.audioContext) return;
            try {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                // 更高的音调表示暴击
                oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(1200, this.audioContext.currentTime + 0.15);
                gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.15);
            } catch (e) {
                console.warn('播放音效失败:', e);
            }
        }
    };

    // ==================== UI 渲染系统 ====================
    const UIRenderer = {
        updateFishCount(animate = true) {
            const newValue = Math.floor(GameState.fish).toLocaleString();
            const oldValue = elements.fishCount.textContent;
            
            if (animate && newValue !== oldValue) {
                elements.fishCount.classList.add('updating');
                setTimeout(() => {
                    elements.fishCount.classList.remove('updating');
                }, 500);
            }
            
            elements.fishCount.textContent = newValue;
        },

        updateFishPerClick(animate = true) {
            const actualValue = UpgradeCalculator.calculateActualClickValue();
            const newValue = actualValue.toFixed(1);
            const oldValue = elements.fishPerClick.textContent;
            
            if (animate && newValue !== oldValue) {
                elements.fishPerClick.classList.add('updating');
                setTimeout(() => {
                    elements.fishPerClick.classList.remove('updating');
                }, 500);
            }
            
            elements.fishPerClick.textContent = newValue;
        },
        
        updateFishPerSecond() {
            const actualValue = UpgradeCalculator.calculateActualPerSecond();
            elements.fishPerSecond.textContent = actualValue.toFixed(1);
        },
        
        updatePrestigeBonus() {
            if (GameState.prestigeLevel > 0) {
                elements.prestigeBonusItem.style.display = 'flex';
                elements.prestigeBonus.textContent = `+${(GameState.prestigeBonus * 100).toFixed(1)}%`;
            }
        },

        showFloatingText(amount, x, y, isCrit = false) {
            const text = document.createElement('div');
            text.className = 'floating-text';
            const formattedAmount = Math.floor(amount).toLocaleString();
            if (isCrit) {
                text.style.color = '#FF6B6B';
                text.style.fontSize = '28px';
                text.textContent = `暴击! +${formattedAmount} 🐟`;
            } else {
                text.textContent = `+${formattedAmount} 鱼鱼`;
            }
            
            const mainRect = elements.cat.closest('.main-content').getBoundingClientRect();
            const relativeX = x - mainRect.left;
            const relativeY = y - mainRect.top;
            
            text.style.left = `${relativeX}px`;
            text.style.top = `${relativeY}px`;
            text.style.transform = 'translateX(-50%)';

            elements.floatingTexts.appendChild(text);

            setTimeout(() => {
                if (text.parentNode) {
                    text.parentNode.removeChild(text);
                }
            }, 1200);
        },

        showFishCaughtAnimation(x, y) {
            const fishIcon = document.createElement('div');
            fishIcon.className = 'fish-caught';
            fishIcon.textContent = '🐟';
            
            const mainRect = elements.cat.closest('.main-content').getBoundingClientRect();
            const hookRect = elements.rodHook.getBoundingClientRect();
            const hookRelativeX = hookRect.left - mainRect.left + hookRect.width / 2;
            const hookRelativeY = hookRect.top - mainRect.top + hookRect.height;
            
            fishIcon.style.left = `${hookRelativeX}px`;
            fishIcon.style.top = `${hookRelativeY}px`;
            fishIcon.style.transform = 'translate(-50%, -50%)';

            elements.fishAnimationContainer.appendChild(fishIcon);

            requestAnimationFrame(() => {
                fishIcon.classList.add('animate');
            });

            setTimeout(() => {
                if (fishIcon.parentNode) {
                    fishIcon.parentNode.removeChild(fishIcon);
                }
            }, 800);
        },

        /**
         * 渲染升级商店 - 显示下一级效果
         */
        renderUpgrades() {
            elements.upgradesList.innerHTML = '';

            Object.keys(GameState.upgrades).forEach(upgradeKey => {
                const upgrade = GameState.upgrades[upgradeKey];
                const currentLevel = upgrade.level;
                const nextLevel = currentLevel + 1;
                const cost = UpgradeCalculator.calculateCost(upgrade, currentLevel);
                const canAfford = GameState.fish >= cost;
                
                const upgradeItem = document.createElement('div');
                upgradeItem.className = `upgrade-item ${canAfford ? '' : 'disabled'}`;
                
                // 构建下一级效果描述
                let nextEffectText = '';
                if (upgradeKey === 'clickPower') {
                    const currentEffect = upgrade.getEffect(currentLevel);
                    const nextEffect = upgrade.getEffect(nextLevel);
                    nextEffectText = `下一级: +${nextEffect - currentEffect} 点击值`;
                } else if (upgradeKey === 'autoFishing') {
                    const currentEffect = upgrade.getEffect(currentLevel);
                    const nextEffect = upgrade.getEffect(nextLevel);
                    nextEffectText = `下一级: +${nextEffect - currentEffect} 每秒收益`;
                } else if (upgradeKey === 'luckyFish') {
                    const currentChance = upgrade.getCritChance(currentLevel);
                    const nextChance = upgrade.getCritChance(nextLevel);
                    nextEffectText = `下一级: 暴击率 ${(currentChance * 100).toFixed(1)}% → ${(nextChance * 100).toFixed(1)}%`;
                } else if (upgradeKey === 'catCompanion') {
                    const currentMultiplier = upgrade.getMultiplier(currentLevel);
                    const nextMultiplier = upgrade.getMultiplier(nextLevel);
                    nextEffectText = `下一级: 全局倍率 ${currentMultiplier.toFixed(1)}x → ${nextMultiplier.toFixed(1)}x`;
                }
                
                upgradeItem.innerHTML = `
                    <div class="upgrade-name">${upgrade.icon} ${upgrade.name}</div>
                    <div class="upgrade-description">${upgrade.description}</div>
                    <div class="upgrade-next-effect">${nextEffectText}</div>
                    <div class="upgrade-cost">💰 ${Math.floor(cost).toLocaleString()} 鱼鱼</div>
                    <div class="upgrade-level">当前等级: ${currentLevel}</div>
                `;

                if (canAfford) {
                    upgradeItem.addEventListener('click', () => {
                        GameManager.purchaseUpgrade(upgradeKey);
                    });
                }

                elements.upgradesList.appendChild(upgradeItem);
            });
        },
        
        /**
         * 渲染成就列表
         */
        renderAchievements() {
            elements.achievementsList.innerHTML = '';
            
            GameConfig.MILESTONES.forEach((milestone, index) => {
                const achievementItem = document.createElement('div');
                const isUnlocked = GameState.unlockedAchievements.has(milestone);
                achievementItem.className = `achievement-item ${isUnlocked ? 'unlocked' : ''}`;
                
                achievementItem.innerHTML = `
                    <div class="achievement-icon">${isUnlocked ? '🏆' : '🔒'}</div>
                    <div class="achievement-content">
                        <div class="achievement-name">获得 ${milestone.toLocaleString()} 条鱼</div>
                        <div class="achievement-description">
                            ${isUnlocked ? '✅ 已完成！' : `进度: ${Math.min(GameState.totalFishEarned, milestone).toLocaleString()} / ${milestone.toLocaleString()}`}
                        </div>
                    </div>
                `;
                
                elements.achievementsList.appendChild(achievementItem);
            });
        },

        updateMuteButton() {
            elements.muteBtn.textContent = GameState.muted ? '🔇' : '🔊';
            elements.muteBtn.classList.toggle('muted', GameState.muted);
        }
    };

    // ==================== 成就系统 ====================
    const AchievementManager = {
        /**
         * 检查并解锁成就
         */
        checkAchievements() {
            GameConfig.MILESTONES.forEach(milestone => {
                if (!GameState.unlockedAchievements.has(milestone) && GameState.totalFishEarned >= milestone) {
                    GameState.unlockedAchievements.add(milestone);
                    // 可以在这里添加解锁动画或通知
                }
            });
        },
        
        /**
         * 显示成就面板
         */
        showPanel() {
            UIRenderer.renderAchievements();
            elements.achievementsPanel.style.display = 'block';
        },
        
        /**
         * 隐藏成就面板
         */
        hidePanel() {
            elements.achievementsPanel.style.display = 'none';
        }
    };

    // ==================== 游戏逻辑管理 ====================
    const GameManager = {
        autoFishingInterval: null,

        init() {
            this.loadGame();
            SoundManager.init();
            this.bindEvents();
            
            // 更新全局倍率
            this.updateGlobalMultiplier();
            
            // 初始化 UI
            UIRenderer.updateFishCount(false);
            UIRenderer.updateFishPerClick(false);
            UIRenderer.updateFishPerSecond();
            UIRenderer.updatePrestigeBonus();
            UIRenderer.renderUpgrades();
            UIRenderer.updateMuteButton();
            
            // 检查转生按钮显示
            this.updatePrestigeButton();
            
            // 启动自动钓鱼（如果已解锁）
            if (GameState.upgrades.autoFishing.level > 0) {
                this.startAutoFishing();
            }

            // 定期保存游戏
            setInterval(() => {
                this.saveGame();
            }, 10000);
        },

        bindEvents() {
            elements.cat.addEventListener('click', (e) => {
                this.handleCatClick(e);
            });

            elements.cat.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.handleCatClick(e);
            });

            elements.muteBtn.addEventListener('click', () => {
                GameState.muted = !GameState.muted;
                UIRenderer.updateMuteButton();
                this.saveGame();
            });
            
            elements.achievementsBtn.addEventListener('click', () => {
                AchievementManager.showPanel();
            });
            
            elements.closeAchievements.addEventListener('click', () => {
                AchievementManager.hidePanel();
            });
            
            elements.prestigeBtn.addEventListener('click', () => {
                this.performPrestige();
            });

            window.addEventListener('beforeunload', () => {
                this.saveGame();
            });
        },

        handleCatClick(e) {
            // 动画效果
            elements.cat.classList.remove('clicking');
            requestAnimationFrame(() => {
                elements.cat.classList.add('clicking');
                setTimeout(() => {
                    elements.cat.classList.remove('clicking');
                }, 400);
            });

            elements.fishingRod.classList.remove('click-swing');
            requestAnimationFrame(() => {
                elements.fishingRod.classList.add('click-swing');
                setTimeout(() => {
                    elements.fishingRod.classList.remove('click-swing');
                }, 500);
            });

            // 计算基础收益
            let baseGain = UpgradeCalculator.calculateActualClickValue();
            
            // 检查暴击
            let isCrit = false;
            const critChance = GameState.upgrades.luckyFish.getCritChance(
                GameState.upgrades.luckyFish.level
            );
            
            if (Math.random() < critChance) {
                isCrit = true;
                const critMultiplier = GameState.upgrades.luckyFish.getCritMultiplier(
                    GameState.upgrades.luckyFish.level
                );
                baseGain = Math.floor(baseGain * critMultiplier);
                SoundManager.playCritSound();
            } else {
                SoundManager.playClickSound();
            }

            GameState.fish += baseGain;
            GameState.totalFishEarned += baseGain;

            // 检查成就
            AchievementManager.checkAchievements();

            const rect = elements.cat.getBoundingClientRect();
            const clickX = (e.clientX || e.touches?.[0]?.clientX || rect.left + rect.width / 2);
            const clickY = (e.clientY || e.touches?.[0]?.clientY || rect.top + rect.height / 2);

            UIRenderer.showFloatingText(actualGain, clickX, clickY, isCrit);
            UIRenderer.showFishCaughtAnimation(clickX, clickY);

            UIRenderer.updateFishCount(true);
            UIRenderer.renderUpgrades();
            this.updatePrestigeButton();

            this.saveGame();
        },

        purchaseUpgrade(upgradeKey) {
            const upgrade = GameState.upgrades[upgradeKey];
            const cost = UpgradeCalculator.calculateCost(upgrade, upgrade.level);

            if (GameState.fish < cost) {
                return;
            }

            GameState.fish -= cost;
            upgrade.level++;

            // 更新全局倍率（如果是猫猫伙伴）
            if (upgradeKey === 'catCompanion') {
                this.updateGlobalMultiplier();
            }

            SoundManager.playUpgradeSound();

            UIRenderer.updateFishCount(true);
            UIRenderer.updateFishPerClick(true);
            UIRenderer.updateFishPerSecond();
            UIRenderer.renderUpgrades();
            
            // 如果购买了自动钓鱼，启动它
            if (upgradeKey === 'autoFishing' && upgrade.level === 1) {
                this.startAutoFishing();
            }

            // 购买成功动画
            setTimeout(() => {
                const upgradeItems = elements.upgradesList.querySelectorAll('.upgrade-item');
                const upgradeNames = Object.keys(GameState.upgrades);
                const upgradeIndex = upgradeNames.indexOf(upgradeKey);
                
                if (upgradeIndex !== -1 && upgradeItems[upgradeIndex]) {
                    const purchasedItem = upgradeItems[upgradeIndex];
                    purchasedItem.classList.remove('purchased');
                    requestAnimationFrame(() => {
                        purchasedItem.classList.add('purchased');
                        setTimeout(() => {
                            purchasedItem.classList.remove('purchased');
                        }, 600);
                    });
                }
            }, 0);

            this.saveGame();
        },
        
        /**
         * 更新全局倍率
         */
        updateGlobalMultiplier() {
            GameState.globalMultiplier = GameState.upgrades.catCompanion.getMultiplier(
                GameState.upgrades.catCompanion.level
            );
        },

        startAutoFishing() {
            if (this.autoFishingInterval) {
                clearInterval(this.autoFishingInterval);
            }

            this.autoFishingInterval = setInterval(() => {
                if (GameState.upgrades.autoFishing.level > 0) {
                    const gained = Math.floor(UpgradeCalculator.calculateActualPerSecond());
                    GameState.fish += gained;
                    GameState.totalFishEarned += gained;
                    
                    // 检查成就
                    AchievementManager.checkAchievements();
                    
                    UIRenderer.updateFishCount();
                    UIRenderer.renderUpgrades();
                    this.updatePrestigeButton();
                }
            }, GameState.upgrades.autoFishing.interval);
        },
        
        /**
         * 更新转生按钮显示
         */
        updatePrestigeButton() {
            if (GameState.fish >= GameConfig.PRESTIGE_FISH_REQUIREMENT) {
                elements.prestigeBtn.style.display = 'block';
                const prestigeLevel = GameState.prestigeLevel;
                const nextBonus = (prestigeLevel + 1) * GameConfig.PRESTIGE_BONUS_PER_LEVEL * 100;
                elements.prestigeBtn.textContent = `🔄 转生 (获得 +${nextBonus.toFixed(1)}% 永久加成)`;
            } else {
                elements.prestigeBtn.style.display = 'none';
            }
        },
        
        /**
         * 执行转生
         */
        performPrestige() {
            if (GameState.fish < GameConfig.PRESTIGE_FISH_REQUIREMENT) {
                return;
            }
            
            if (!confirm(`确定要转生吗？\n\n你将失去所有鱼和升级，但获得 +${((GameState.prestigeLevel + 1) * GameConfig.PRESTIGE_BONUS_PER_LEVEL * 100).toFixed(1)}% 的永久加成！`)) {
                return;
            }
            
            // 增加转生等级和加成
            GameState.prestigeLevel++;
            GameState.prestigeBonus = GameState.prestigeLevel * GameConfig.PRESTIGE_BONUS_PER_LEVEL;
            
            // 重置游戏状态（保留成就和转生等级）
            GameState.fish = 0;
            GameState.totalFishEarned = 0;
            
            Object.keys(GameState.upgrades).forEach(key => {
                GameState.upgrades[key].level = 0;
            });
            
            GameState.autoFishingActive = false;
            this.updateGlobalMultiplier();
            
            // 重启自动钓鱼（现在是0级，不会运行）
            if (this.autoFishingInterval) {
                clearInterval(this.autoFishingInterval);
                this.autoFishingInterval = null;
            }
            
            // 更新UI
            UIRenderer.updateFishCount(false);
            UIRenderer.updateFishPerClick(false);
            UIRenderer.updateFishPerSecond();
            UIRenderer.updatePrestigeBonus();
            UIRenderer.renderUpgrades();
            this.updatePrestigeButton();
            
            this.saveGame();
        },

        saveGame() {
            try {
                const saveData = {
                    fish: GameState.fish,
                    totalFishEarned: GameState.totalFishEarned,
                    fishPerClick: GameState.fishPerClick,
                    prestigeLevel: GameState.prestigeLevel,
                    prestigeBonus: GameState.prestigeBonus,
                    upgrades: {},
                    unlockedAchievements: Array.from(GameState.unlockedAchievements),
                    muted: GameState.muted
                };
                
                // 保存升级状态
                Object.keys(GameState.upgrades).forEach(key => {
                    saveData.upgrades[key] = {
                        level: GameState.upgrades[key].level
                    };
                });
                
                localStorage.setItem('catFishingGame', JSON.stringify(saveData));
            } catch (e) {
                console.warn('保存游戏失败:', e);
            }
        },

        loadGame() {
            try {
                const saveData = localStorage.getItem('catFishingGame');
                if (saveData) {
                    const data = JSON.parse(saveData);
                    GameState.fish = data.fish || 0;
                    GameState.totalFishEarned = data.totalFishEarned || 0;
                    GameState.fishPerClick = data.fishPerClick || 1;
                    GameState.prestigeLevel = data.prestigeLevel || 0;
                    GameState.prestigeBonus = data.prestigeBonus || 0;
                    GameState.unlockedAchievements = new Set(data.unlockedAchievements || []);
                    GameState.muted = data.muted || false;
                    
                    // 加载升级状态
                    if (data.upgrades) {
                        Object.keys(data.upgrades).forEach(key => {
                            if (GameState.upgrades[key] && data.upgrades[key].level !== undefined) {
                                GameState.upgrades[key].level = data.upgrades[key].level;
                            }
                        });
                    }
                }
            } catch (e) {
                console.warn('加载游戏失败:', e);
            }
        }
    };

    // ==================== 启动游戏 ====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            GameManager.init();
        });
    } else {
        GameManager.init();
    }

})();
