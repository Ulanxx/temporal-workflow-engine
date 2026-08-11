import { BrowserActionType } from '@temporal-workflow-engine/shared';
import { chromium, Browser, Page, BrowserContext } from 'playwright';

// 存储浏览器实例
let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

// 浏览器状态标志
let browserInitialized = false;
let browserClosed = true; // 默认设为true，确保第一次调用时会初始化浏览器

/**
 * 初始化浏览器
 */
export async function initBrowser() {
  try {
    // 如果浏览器已关闭或未初始化，则创建新实例
    if (browserClosed || !browser || !page || !context) {
      // 安全起见，先尝试关闭现有实例
      await safeCloseBrowser();
      
      console.log('正在初始化新的浏览器实例...');
      
      const browserType = chromium;
      const browserArgs = [
        '--start-maximized',
        '--disable-dev-shm-usage', // 解决Linux上的内存问题
        '--no-sandbox', // 某些环境可能需要
        '--disable-setuid-sandbox'
      ];
      
      // 启动新的浏览器实例
      browser = await browserType.launch({
        headless: false,
        devtools: false, // 设为false减少问题
        args: browserArgs,
        timeout: 60000, // 增加启动超时
      });
      
      // 创建新的浏览器上下文和页面
      context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      });
      
      page = await context.newPage();
      
      // 设置页面默认超时
      await page.setDefaultTimeout(30000);
      
      // 设置事件监听，处理意外关闭情况
      browser.on('disconnected', () => {
        console.log('浏览器已断开连接');
        browserClosed = true;
        browser = null;
        context = null;
        page = null;
      });
      
      browserInitialized = true;
      browserClosed = false;
      
      console.log('浏览器初始化成功');
    } else {
      console.log('使用现有浏览器实例');
    }
    
    // 验证浏览器和页面状态
    if (!browser || browser.isConnected() === false) {
      console.warn('浏览器未连接，需要重新初始化');
      browserClosed = true;
      return await initBrowser(); // 递归重试
    }
    
    // 验证页面是否关闭
    if (page && page.isClosed()) {
      console.warn('页面已关闭，创建新页面');
      try {
        page = await context!.newPage();
      } catch (pageError) {
        console.error('创建新页面失败，重新初始化浏览器:', pageError);
        browserClosed = true;
        return await initBrowser(); // 递归重试
      }
    }
    
    return { browser, context, page };
  } catch (error) {
    console.error('初始化浏览器失败:', error);
    // 确保重置状态
    browserClosed = true;
    browser = null;
    context = null;
    page = null;
    throw error;
  }
}

/**
 * 安全关闭浏览器
 * 无论当前状态如何，尝试彻底清理浏览器实例
 */
async function safeCloseBrowser() {
  try {
    if (page) {
      await page.close().catch(e => console.log('关闭页面出错:', e));
    }
    if (context) {
      await context.close().catch(e => console.log('关闭上下文出错:', e));
    }
    if (browser) {
      await browser.close().catch(e => console.log('关闭浏览器出错:', e));
    }
  } catch (error) {
    console.error('关闭浏览器时发生错误:', error);
  } finally {
    // 无论如何都重置状态
    browser = null;
    context = null;
    page = null;
    browserClosed = true;
    browserInitialized = false;
  }
}

/**
 * 关闭浏览器
 */
export async function closeBrowser() {
  await safeCloseBrowser();
  console.log('浏览器已成功关闭');
}

/**
 * 执行浏览器动作
 */
export async function executeBrowserAction(params: {
  actionType: string;
  url?: string;
  selector?: string;
  text?: string;
  timeout?: number;
  options?: Record<string, any>;
}): Promise<any> {
  const { actionType, url, selector, text, timeout = 30000, options = {} } = params;
  
  // 最大重试次数
  const maxRetries = 2;
  let retries = 0;
  
  while (retries <= maxRetries) {
    try {
      // 确保浏览器已初始化
      console.log(`[执行浏览器动作] ${actionType} - 尝试 ${retries + 1}/${maxRetries + 1}`);
      const { page } = await initBrowser();
      
      if (!page) {
        throw new Error('浏览器页面未初始化');
      }
      
      // 检查浏览器连接状态
      if (!browser || !browser.isConnected()) {
        console.warn('浏览器未连接，重新初始化...');
        browserClosed = true;
        if (retries < maxRetries) {
          retries++;
          continue;
        } else {
          throw new Error('浏览器连接失败，已达到最大重试次数');
        }
      }
      
      // 检查页面是否已关闭
      if (page.isClosed()) {
        console.warn('页面已关闭，重新初始化...');
        browserClosed = true;
        if (retries < maxRetries) {
          retries++;
          continue;
        } else {
          throw new Error('页面持续关闭，已达到最大重试次数');
        }
      }
    
      // 根据动作类型执行相应操作
      console.log(`执行动作: ${actionType}`);
      switch (actionType) {
      case BrowserActionType.NAVIGATE:
        if (!url) throw new Error('导航操作需要提供URL');
        
        // 确保URL格式正确
        let formattedUrl = url.trim();
        
        // 如果URL不包含协议，添加https://
        if (!/^https?:\/\//i.test(formattedUrl)) {
          formattedUrl = `https://${formattedUrl}`;
          console.log(`URL缺少协议，已自动添加https://，现在URL为: ${formattedUrl}`);
        }
        
        try {
          // 尝试解析URL以验证其有效性
          new URL(formattedUrl);
          
          console.log(`正在导航到: ${formattedUrl}`);
          
          // 验证浏览器和页面状态
          if (!browser || !browser.isConnected() || !page || page.isClosed()) {
            throw new Error('浏览器或页面状态无效，无法导航');
          }
          
          // 增加导航重试逻辑
          let navResponse;
          const navMaxRetries = 2;
          let navRetries = 0;
          
          while (navRetries <= navMaxRetries) {
            try {
              navResponse = await page.goto(formattedUrl, { 
                timeout: Math.max(timeout, 30000), // 至少30秒超时
                waitUntil: 'domcontentloaded', // 更可靠的等待策略
                ...options 
              });
              break; // 成功则跳出循环
            } catch (navError: any) {
              if (navRetries < navMaxRetries && 
                  (navError.message.includes('Target page, context or browser has been closed') ||
                   navError.message.includes('Navigation timeout'))) {
                console.log(`导航重试 (${navRetries + 1}/${navMaxRetries})...`);
                navRetries++;
                await new Promise(r => setTimeout(r, 1000)); // 等待1秒再重试
              } else {
                throw navError; // 达到最大重试次数，抛出错误
              }
            }
          }
          
          const response = navResponse;
          
          // 检查响应状态
          if (!response) {
            console.warn(`导航到 ${formattedUrl} 没有收到响应`);
            return { 
              success: true, 
              title: await page.title(),
              warning: '页面导航未返回响应，但操作没有失败' 
            };
          }
          
          if (!response.ok()) {
            console.warn(`导航到 ${formattedUrl} 收到HTTP错误: ${response.status()}`);
            return { 
              success: true, 
              title: await page.title(),
              currentUrl: page.url(),
              warning: `页面返回了HTTP状态码: ${response.status()}` 
            };
          }
          
          return { 
            success: true, 
            title: await page.title(),
            currentUrl: page.url()
          };
        } catch (urlError) {
          console.error(`导航错误: ${urlError}`);
          throw new Error(`URL格式无效或导航失败: ${urlError}`);
        }
        
      case BrowserActionType.CLICK:
        if (!selector) throw new Error('点击操作需要提供选择器');
        await page.waitForSelector(selector, { timeout });
        await page.click(selector, options);
        return { success: true };
        
      case BrowserActionType.TYPE:
        if (!selector) throw new Error('输入操作需要提供选择器');
        if (text === undefined) throw new Error('输入操作需要提供文本');
        await page.waitForSelector(selector, { timeout });
        await page.fill(selector, text, options);
        return { success: true };
        
      case BrowserActionType.SELECT:
        if (!selector) throw new Error('选择操作需要提供选择器');
        if (!text) throw new Error('选择操作需要提供选项值');
        await page.waitForSelector(selector, { timeout });
        await page.selectOption(selector, text, options);
        return { success: true };
        
      case BrowserActionType.WAIT_FOR_SELECTOR:
        if (!selector) throw new Error('等待操作需要提供选择器');
        await page.waitForSelector(selector, { timeout, ...options });
        return { success: true };
        
      case BrowserActionType.WAIT_FOR_NAVIGATION:
        await page.waitForNavigation({ timeout, ...options });
        return { success: true, url: page.url() };
        
      case BrowserActionType.SCREENSHOT:
        const screenshotBuffer = await page.screenshot(options);
        return { 
          success: true, 
          screenshot: screenshotBuffer.toString('base64')
        };
        
      case BrowserActionType.EXTRACT_DATA:
        if (!selector) throw new Error('数据提取操作需要提供选择器');
        await page.waitForSelector(selector, { timeout });
        const data = await page.$$eval(selector, (elements, opts) => {
          return elements.map(el => {
            if (opts.textOnly) {
              return el.textContent?.trim();
            }
            // 返回元素的文本内容和其他属性
            const attributes: Record<string, string> = {};
            Array.from(el.attributes).forEach(attr => {
              attributes[attr.name] = attr.value;
            });
            return {
              text: el.textContent?.trim(),
              attributes
            };
          });
        }, { textOnly: options.textOnly });
        return { success: true, data };
        
      default:
        throw new Error(`不支持的浏览器动作类型: ${actionType}`);
    }
    } catch (error: any) {
      console.error(`执行浏览器动作失败: ${error}`);
      
      // 检查是否与浏览器连接相关的错误
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isBrowserConnectionError = errorMsg.includes('Target page, context or browser has been closed') || 
                                       errorMsg.includes('Browser has been closed') ||
                                       errorMsg.includes('Target closed') ||
                                       errorMsg.includes('Connection closed');
      
      if (isBrowserConnectionError && retries < maxRetries) {
        console.log(`检测到浏览器连接错误，尝试重新初始化... (${retries + 1}/${maxRetries})`);
        browserClosed = true;
        browser = null;
        context = null;
        page = null;
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒再重试
        retries++;
        continue;
      }
      
      return { 
        success: false, 
        error: errorMsg 
      };
    }
    
    // 如果执行成功，跳出重试循环
    break;
  }
}
