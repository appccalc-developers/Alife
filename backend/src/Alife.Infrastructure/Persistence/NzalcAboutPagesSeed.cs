using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Infrastructure.Persistence;

public static class NzalcAboutPagesSeed
{
    private const string AssetOrigin = "https://pages.nzalc.org/";
    private const string MenuNameEn = "About Us";
    private const string MenuNameZh = "关于我们";

    private sealed record PageSeed(
        string Key,
        string SourcePath,
        string TitleEn,
        string TitleZh,
        string DescriptionEn,
        string DescriptionZh,
        string HeroTextEn,
        string HeroTextZh,
        string HeroImageUrl,
        string BodyEn,
        string BodyZh);

    private static readonly IReadOnlyList<PageSeed> Pages =
    [
        new(
            "pastoral-team",
            "2014-02-06-22-12-16/2014-02-25-03-09-53.html",
            "Pastoral Team",
            "教牧团队",
            "Pastoral and ministry teams presented on the church's 2021 website.",
            "原教会网站于 2021 年展示的教牧与事奉团队。",
            "Meet the pastoral leaders and ministry teams who served across the life of the church.",
            "认识在教会各项生活与事工中服事的教牧领袖和团队。",
            $"{AssetOrigin}images/alc/ChurchTeam/New2021/Psters2.jpg",
            """
			<h2>Pastoral and ministry teams</h2>
			<p><img src="https://pages.nzalc.org/images/alc/ChurchTeam/New2021/Psters2.jpg" alt="Pastor De Xian Huang and Mrs Hui Qiong Huang" width="460" height="346" /></p>
			<p><strong>Senior Pastor:</strong> Pastor De Xian Huang and Mrs Hui Qiong Huang.</p>
			<p><img src="https://pages.nzalc.org/images/alc/ChurchTeam/New2021/Deacons.jpeg" alt="Board of deacons" width="500" height="341" /></p>
			<p><strong>Board of deacons.</strong> Not pictured: Chang Shan Zhao and Jing Jie Huang.</p>
			<p><img src="https://pages.nzalc.org/images/alc/ChurchTeam/New2021/Youth_group_team__Boy_Brigade_team.jpeg" alt="Youth Group and Boys' Brigade team" width="500" height="350" /></p>
			<p><strong>Youth Group and Boys' Brigade team.</strong></p>
			<p><img src="https://pages.nzalc.org/images/alc/ChurchTeam/New2021/Carers_welcomers.jpeg" alt="Care and welcome team" width="780" height="337" /></p>
			<p><strong>Care and welcome team.</strong></p>
			<p><img src="https://pages.nzalc.org/images/alc/ChurchTeam/New2021/IMG_1956.jpeg" alt="Worship team" width="500" height="303" /></p>
			<p><strong>Worship and praise team.</strong></p>
			<p><img src="https://pages.nzalc.org/images/alc/ChurchTeam/New2021/Prayers.jpeg" alt="Prayer team" width="500" height="361" /></p>
			<p><strong>Prayer team.</strong></p>
			<p><img src="https://pages.nzalc.org/images/alc/ChurchTeam/New2021/group_leaders.jpeg" alt="Life-group leaders" width="600" height="324" /></p>
			<p><strong>Life-group leaders.</strong> Several leaders were not pictured.</p>
			<p><img src="https://pages.nzalc.org/images/alc/ChurchTeam/New2021/IMG_2486.jpeg" alt="Church prayer gathering" width="550" height="309" /></p>
			<p><strong>Participants in a church prayer gathering.</strong> Several participants were not pictured.</p>
			<p><img src="https://pages.nzalc.org/images/alc/ChurchTeam/New2021/Sunday_School.jpeg" alt="Sunday school team" width="540" height="314" /></p>
			<p><strong>Sunday school team.</strong></p>
			<p><img src="https://pages.nzalc.org/images/alc/ChurchTeam/New2021/IMG_6425.jpeg" alt="John and Ruth commissioned for overseas mission" width="500" height="322" /></p>
			<p><strong>Overseas mission workers:</strong> John and Ruth.</p>
			<p><img src="https://pages.nzalc.org/images/alc/ChurchTeam/New2021/IMG_1947.jpeg" alt="2021 ministry retreat" width="500" height="309" /></p>
			<p><strong>2021 ministry retreat.</strong></p>
			<p><img src="https://pages.nzalc.org/images/alc/ChurchTeam/New2021/IMG_6431.jpeg" alt="Church praying over commissioned overseas mission workers" width="550" height="317" /></p>
			<p><strong>Commissioning overseas mission workers:</strong> the church raises hands in prayer and sends them out.</p>
			""",
            """
			<h2>教牧与事奉团队</h2>
			<p><img src="https://pages.nzalc.org/images/alc/ChurchTeam/New2021/Psters2.jpg" alt="黄德贤牧师与黄吴惠琼师母" width="460" height="346" /></p>
			<p><strong>主任牧师：</strong>黄德贤牧师、黄吴惠琼师母。</p>
			<p><img src="https://pages.nzalc.org/images/alc/ChurchTeam/New2021/Deacons.jpeg" alt="执事会同工" width="500" height="341" /></p>
			<p><strong>执事会同工。</strong>未在照片者：赵长山、黄敬杰。</p>
			<p><img src="https://pages.nzalc.org/images/alc/ChurchTeam/New2021/Youth_group_team__Boy_Brigade_team.jpeg" alt="青少年与男少年军团队" width="500" height="350" /></p>
			<p><strong>青少年与男少年军团队。</strong></p>
			<p><img src="https://pages.nzalc.org/images/alc/ChurchTeam/New2021/Carers_welcomers.jpeg" alt="关怀员和招待员" width="780" height="337" /></p>
			<p><strong>关怀员和招待员。</strong></p>
			<p><img src="https://pages.nzalc.org/images/alc/ChurchTeam/New2021/IMG_1956.jpeg" alt="敬拜赞美同工" width="500" height="303" /></p>
			<p><strong>敬拜赞美同工。</strong></p>
			<p><img src="https://pages.nzalc.org/images/alc/ChurchTeam/New2021/Prayers.jpeg" alt="代祷者团队" width="500" height="361" /></p>
			<p><strong>代祷者团队。</strong></p>
			<p><img src="https://pages.nzalc.org/images/alc/ChurchTeam/New2021/group_leaders.jpeg" alt="小家长团队" width="600" height="324" /></p>
			<p><strong>小家长团队。</strong>有多位未在照片里。</p>
			<p><img src="https://pages.nzalc.org/images/alc/ChurchTeam/New2021/IMG_2486.jpeg" alt="教会代祷聚会参加者" width="550" height="309" /></p>
			<p><strong>教会代祷聚会参加者。</strong>有多位未在照片里。</p>
			<p><img src="https://pages.nzalc.org/images/alc/ChurchTeam/New2021/Sunday_School.jpeg" alt="主日学同工" width="540" height="314" /></p>
			<p><strong>主日学同工。</strong></p>
			<p><img src="https://pages.nzalc.org/images/alc/ChurchTeam/New2021/IMG_6425.jpeg" alt="差派海外宣教同工 John 和 Ruth" width="500" height="322" /></p>
			<p><strong>差派海外宣教同工：</strong>John 和 Ruth。</p>
			<p><img src="https://pages.nzalc.org/images/alc/ChurchTeam/New2021/IMG_1947.jpeg" alt="2021 年同工退修会" width="500" height="309" /></p>
			<p><strong>2021 年同工退修会。</strong></p>
			<p><img src="https://pages.nzalc.org/images/alc/ChurchTeam/New2021/IMG_6431.jpeg" alt="为差派的海外宣教同工举手祝祷" width="550" height="317" /></p>
			<p><strong>差派海外宣教同工：</strong>大家举手祝祷差遣。</p>
			"""),
        new(
            "church-introduction",
            "2014-02-06-22-12-16/2014-02-25-03-20-06.html",
            "Church Introduction",
            "教会介绍",
            "An introduction to Abundant Life Church and the story of its founding in Christchurch.",
            "丰盛生命教会简介，以及教会在基督城成立的历史。",
            "I have come that they may have life, and have it to the full. — John 10:10",
            "我来了，是要叫人得生命，并且得的更丰盛。——约翰福音 10:10",
            $"{AssetOrigin}images/IMG_1324.JPG",
            """
			<blockquote>Jesus said, “I have come that they may have life, and have it to the full.” (John 10:10)</blockquote>
			<p>We are an independent church firmly committed to biblical truth, exalting Jesus Christ, relying on the power of the Holy Spirit, proclaiming the Word and the gospel, making disciples of Jesus, exercising spiritual gifts, and caring for people through small groups. We value both evangelism and the work of the Holy Spirit. We continually seek to build a healthy, vibrant, strong, and influential church that glorifies God and blesses people.</p>
			<p>We are committed to building a community of faith, love, and holiness: a living, Spirit-filled church in which people fulfil the mission God has given them.</p>
			<h2>A brief history of Abundant Life Church</h2>
			<h3>1. The founding of the church</h3>
			<p><img src="https://pages.nzalc.org/images/IMG_1324.JPG" alt="Abundant Life Church community" width="500" height="373" /></p>
			<p>In the spring of 2003, after more than eight years of pastoral ministry in Christchurch, Pastor De Xian Huang and his wife clearly sensed God's leading to hand over their responsibilities and leave the church where they had served. They went to a farm at West Eyreton in North Canterbury for five quiet days of fasting and prayer, seeking the Lord's direction about whether to serve in Taiwan, Kuching in Malaysia, or Christchurch.</p>
			<p>During those five days there were clear skies, snowfall, and two earthquakes of magnitude 4.9. On 1 October, the day the church was founded, there was a magnitude 5.8 earthquake even though the weather was beautifully clear.</p>
			<p>They prayed, waited, listened to sermons, and asked the Lord to show them where to go. By 30 September they understood that the Holy Spirit was leading them to establish a church in Christchurch that valued both evangelism and the gifts of the Spirit. Christchurch provided an opportunity to reach, pastor, and train Chinese immigrants and international students from Malaysia, Singapore, Taiwan, China, and elsewhere. The mission field was wide, and they believed God would use them and the church in itinerant evangelism, church planting, and other mission work.</p>
			<p>On the morning of 1 October, golden sunshine filled the spring landscape with freshness, vitality, and joy. They knelt together to worship God and declared the founding of Abundant Life Church, taking John 10:10 as its theme. They committed themselves for life to building a church that would glorify God through Christ's Great Commandment (Matthew 22:36–40), Great Commission (Matthew 28:18–20), and the power of the Holy Spirit (Acts 1:8), expressed through five purposes: worship, discipleship, fellowship, ministry, and evangelism.</p>
			<p>They then spent more than ten hours prayerfully writing the church's vision, purposes, organisation, principles, constitution, and related documents, returning to Christchurch on the evening of 2 October.</p>
			<p><strong>The first Friday prayer meeting (3 October):</strong> it was originally going to be held by the couple in their room, but a sister invited them to meet at her home. Four people attended: the pastor, his wife, Sister Chong Zhong, and Sister Nancy.</p>
			<p><strong>The first Sunday celebration (5 October):</strong> they had planned to begin with three people in a park, but Sister Nancy again invited them to her home. Six people attended, including two visitors.</p>
			<p>They continued to pray that the Lord would open a door for the gospel and trusted that God would make wonderful provision. They believed He would raise 300 warriors like Gideon's to build a healthy church for His glory. During the first year, a week of fasting and prayer was held about every three months.</p>
			<p>As attendance grew, they looked at four possible venues, but each was unsuitable or unavailable. Through the introduction of a Kiwi pastor, they eventually rented the side hall of North-West New Life Church at 34A Hansons Lane, Upper Riccarton, for a 2 p.m. Sunday celebration. The facilities were simple and the location inconvenient—especially in wet weather, when people walked through mud and rain—but it was a place where they deeply experienced God's anointing. More than thirty people were attending by then.</p>
			<p>The congregation was united, loving, and fervent in prayer. Although worship was accompanied by only one guitar, played by Brother Xiao Rui, people experienced God's presence, delighted in worship, diligently learned His Word, and saw the Lord add those who were being saved.</p>
			<p>Five years later, most of the first group of brothers and sisters were still serving together in unity. The church gave thanks for God's care and mercy.</p>
			<h3>2. One month of pastoral study in the United States (July 2004)</h3>
			<p>Nine months after the church began, average attendance was about sixty. Pastor Huang and his wife attended a one-month intensive course at Agape Renewal Center in the United States. When friends asked whether they were comfortable leaving, the pastor replied that this was God's church and that the co-workers, brothers, and sisters loved and supported their pastors. During the course they grew in their understanding, experience, and practice of the Holy Spirit's work, gifts, and power. The whole church moved forward after their return, and they thanked God for His grace.</p>
			<h3>3. The church's first forty-day fast and prayer gathering (19 August–29 September 2004)</h3>
			<p>About twenty-five people participated in different forms of fasting and prayer. The pastor, his wife, and Jia Hui completed the full forty-day fast. The church experienced a greater spiritual breakthrough and trusted God to bring many good things to pass.</p>
			<h3>4. God did immeasurably more than was asked or imagined (June 2006)</h3>
			<p>The church arranged ten days of fasting and prayer in each half of the year. They asked God to use the church in healing and deliverance, in harp-and-bowl worship, and to provide a place that could become a prayer and worship centre.</p>
			<p>God worked wonderfully through a sister who experienced healing and deliverance at the church after years of physical and emotional difficulties that medicine had not resolved. Her marriage was also renewed. At that time a Salvation Army church building and manse came up for sale. After prayer, a couple who had personally experienced God's grace purchased the property and made it available to the church without charge for ten years. The church received this as a moving testimony of generosity and God's faithfulness, and as a call to serve faithfully, use the property well, glorify God, and bless people.</p>
			<h3>5. The church in 2009</h3>
			<p>By March 2009 the church had begun holding two Sunday celebrations, with average attendance of 110 adults and 22 children in Sunday school. People of all ages formed a spiritual family, with many members coming from China. The church remained committed to building a community of faith, love, and holy living—a healthy, Spirit-filled, influential church in which people fulfil God's mission for their lives. May the name of the Lord Jesus Christ be glorified, and may peace be with His people.</p>
			""",
            """
			<blockquote>耶稣说：“我来了，是要叫人得生命，并且得的更丰盛。”（约翰福音 10:10）</blockquote>
			<p>我们是一间笃信圣经真理、高举耶稣基督、依靠圣灵能力、宣讲圣经真道、传扬基督福音、培育耶稣门徒、发挥圣灵恩赐、以小组牧养模式、福音与灵恩并重的独立教会；并不断努力建立一间健康、活泼、强壮、有影响力、荣神益人的教会。</p>
			<p>我们委身建造信心的群体、爱心的群体及圣洁的群体，发挥上帝给我们的人生使命，成为被圣灵充满、有生命的教会。</p>
			<h2>丰盛生命教会成立简史</h2>
			<h3>一、教会成立过程</h3>
			<p><img src="https://pages.nzalc.org/images/IMG_1324.JPG" alt="丰盛生命教会群体" width="500" height="373" /></p>
			<p>2003 年春，已在基督城牧养八年多的黄德贤牧师、师母清楚上帝的带领，交棒并离开原来的教会。夫妇二人到 North Canterbury West Eyreton 农场安静、禁食祷告五天，寻求主进一步的带领：要往台湾、马来西亚古晋，还是留在基督城牧会。</p>
			<p>在那五天里，万里晴空，却又下雪，还发生了两次里氏 4.9 级地震；在 10 月 1 日教会成立当天又发生 5.8 级地震，但天气非常晴朗。</p>
			<p>除了祷告、等候，他们也聆听讲道信息，恳求主指示要往何处去。直到 9 月 30 日，终于清楚知道圣灵带领他们在基督城建立一间福音与灵恩并重的教会。在基督城可以接触、牧养并培训来自马来西亚、新加坡、台湾、中国等地的华人移民和留学生。禾场非常广阔，将来上帝也会使用牧者和教会参与巡回布道、植堂等宣教工作。</p>
			<p>10 月 1 日早晨，金色阳光普照大地，到处充满春天的清新、活力与兴奋。二人一同跪下敬拜上帝，宣告成立丰盛生命教会，以约翰福音 10:10 为主题；按照耶稣基督颁布的大诫命（马太福音 22:36–40）、大使命（马太福音 28:18–20）及圣灵能力（使徒行传 1:8），借着五大目标——敬拜真神、培育门徒、团契相交、同心事奉、广传福音——建立教会，荣耀上帝的名，并为此一生委身。</p>
			<p>接下来，他们以祷告的心花了十多个小时写下教会的异象、目标、组织、理念、章程等内容，10 月 2 日晚上回到基督城。</p>
			<p><strong>第一次周五祷告会（10 月 3 日）：</strong>本来只有牧师和师母二人在房间举行，后来一位姐妹邀请到她家聚会。当晚共有四人：牧师、师母、崇中姐妹和 Nancy 姐妹。</p>
			<p><strong>第一次主日庆典（10 月 5 日）：</strong>原计划由三人在公园开始，Nancy 姐妹再次邀请大家到她家。当日共有六人参加，其中两位是访客。</p>
			<p>大家除了祷告，还是祷告，求主打开福音的门，也相信上帝必有奇妙的预备，兴起三百位基甸勇士，建立荣耀、健康的教会。第一年大约每三个月举行一次为期一周的禁食祷告会。</p>
			<p>人数渐渐增加后，教会寻找过四个地点，但都不合适或遭到拒绝。后来经一位 Kiwi 牧师介绍，终于租用 North-West New Life Church 的副堂（34A Hansons Lane, Upper Riccarton），举行下午两点的主日庆典。设备简陋、地点偏僻，雨天还要走泥泞路、淋雨，却是一个很有恩膏的地方。当时已有三十多人参加主日庆典。</p>
			<p>大家同心合一、彼此相爱、火热祷告。每次聚会虽然只有晓睿弟兄的一把吉他伴奏，却深深感受到上帝的同在。大家享受敬拜上帝，殷勤学习上帝的话，主也将得救的人天天加给教会。</p>
			<p>五年以后，最早一批弟兄姐妹大多数仍然同心事奉，只有少数流动，教会为上帝的眷顾和怜悯献上感谢。</p>
			<h3>二、牧者赴美国进修一个月（2004 年 7 月）</h3>
			<p>教会成立九个月时，平均出席人数约六十人。黄牧师和师母决定赴美国参加爱修园为期一个月的密集课程。有朋友问是否放心，牧师回答：“这是上帝的教会，而且同工、弟兄姐妹都非常爱护牧者，支持我们安心进修。”在课程中，他们对圣灵的工作与恩赐，以及如何在圣灵能力中运行，有了更深的认识、经历和操练。一个月后回到教会，大家都继续向前，感谢上帝的恩典。</p>
			<h3>三、第一次四十天禁食祷告会（2004 年 8 月 19 日至 9 月 29 日）</h3>
			<p>约有二十五人以不同形式参与禁食祷告，牧师、师母和佳慧完成了全程四十天的禁食。此后教会在灵命上有更大的突破，并深信上帝必使许多美好的事发生。</p>
			<h3>四、上帝的奇妙作为超过所求所想（2006 年 6 月）</h3>
			<p>教会每年上、下半年各安排十天禁食祷告，一方面求上帝使用教会开展医治释放和琴与炉的敬拜事工，一方面求上帝预备一处地点，作为祷告与敬拜中心。</p>
			<p>上帝奇妙地动工：一位姐妹在教会经历医治释放，多年的身心问题未能借医生和药物解决，却在圣灵的大能里得到医治，夫妻关系也被更新。那时正好有一间救世军教堂和牧师馆出售。经过祷告，一对亲尝主恩的夫妇怀着感恩、爱主、爱教会的心购买了产业，无偿提供教会使用十年。这是令人感动的见证和奉献。教会一方面感谢上帝信实地垂听祷告，也感谢这对夫妇的爱心；同时更加谨慎、忠心地事奉主，不白占土地，务求荣神益人。</p>
			<h3>五、2009 年的教会</h3>
			<p>2009 年 3 月，教会已开始两堂主日庆典，平均有一百一十位成人参加，儿童主日学有二十二位孩子，形成一个属灵的大家庭。各年龄层的弟兄姐妹都有，成员以来自中国的华人为主。教会委身建立一群有信心、爱心及圣洁生活的群体，发挥上帝所赐的人生使命，成为一间被圣灵充满、健康、有影响力的教会。愿主耶稣基督的名得荣耀，平安归给祂的百姓。</p>
			"""),
        new(
            "church-principles",
            "2014-02-06-22-12-16/2014-02-10-08-50-35.html",
            "Church Principles",
            "教会理念",
            "Ten principles describing the church's biblical foundation, leadership, mission, and ministry model.",
            "十项教会理念，说明教会的圣经根基、领导、使命与牧养模式。",
            "Biblical truth, Christ-centred leadership, and Spirit-empowered ministry shape the life of the church.",
            "以圣经真理为根基、以基督为元首，并靠圣灵能力建立教会。",
            $"{AssetOrigin}images/slideshow/thumbnail-121.jpg",
            """
			<h2>Church principles</h2>
			<ol>
			<li>We are a church founded on biblical truth, exalting Jesus Christ as our head, relying on the power and gifts of the Holy Spirit to proclaim the gospel and build a church that glorifies God.</li>
			<li>We are an independent church that values both the gospel and the gifts of the Holy Spirit in accordance with Scripture. We respect other denominations that are faithful to biblical truth and learn from their strengths.</li>
			<li>We practise team ministry under the core leadership of the senior pastor, serving in unity and seeking continual growth in order to fulfil God's commission and mission for the universal church.</li>
			<li>We are a purpose-driven church, moving together toward five purposes and helping both believers and the church live them out: worship, discipleship, fellowship, ministry, and evangelism.</li>
			<li>We use cell groups and G12 groups as a pastoral care model so that every person can learn, serve, and grow in community.</li>
			<li>We place a high value on prayer, believing that God speaks to the church through prayer, gives direction for the future, and guides decisions.</li>
			<li>We are committed to long-term leadership, governance, and pastoral care by the senior pastor. The senior pastor leads the church and appoints suitable people to roles that fit their spiritual gifts and SHAPE; these roles are appointed rather than elected.</li>
			<li>We primarily minister among Chinese people, leading them to faith, nurturing and training them, and sending them to share the gospel locally, in their homelands, and in other nations. As God provides sufficient co-workers, we seek to develop English-language ministry and gradually build a multilingual, multi-ethnic, and diverse church.</li>
			<li>We are a city church and do not establish branch congregations within the same city unless travel requires more than an hour and a half. We do, however, actively follow God's leading to plant churches in other cities and nations.</li>
			<li>While holding firmly to unchanging biblical truth, we seek continual renewal so that we may become a stronger, healthier, and more influential church.</li>
			</ol>
			""",
            """
			<h2>教会理念</h2>
			<ol>
			<li>是一间按照圣经真理、高举耶稣基督、以祂为元首、依靠圣灵的能力和恩赐传扬福音，并建立荣耀上帝的教会。</li>
			<li>是一间独立教会，是按照圣经真理、福音与圣灵恩赐并重的教会；尊重其他合乎圣经真理的宗派，并吸取其长处。</li>
			<li>是一间以主任牧师为核心领导、团队事奉、同心合意、力求不断增长的教会，以完成上帝对普世教会的托付和使命。</li>
			<li>是一间目标导向的教会，同心合意向五大目标迈进，使信徒及教会都能活出五大目标：敬拜真神、培育门徒、小组团契、同心事奉、广传福音。</li>
			<li>是一间以细胞小组及 G12 小组为牧养模式的教会，使每一个人都能在群体中学习、服事和成长。</li>
			<li>是一间重视祷告的教会，相信上帝在祷告中向教会说话，指示前途方向并引导决定。</li>
			<li>是一间由主任牧师长期委身领导、治理及牧养的教会。教会由主任牧师领导，并按照属灵恩赐或 SHAPE 特质委任合适的人担任合适的职分；采用委任制而非选举制。</li>
			<li>是一间以牧养华人为主的教会，带领他们信主、栽培塑造、训练并差派他们在本地、家乡或其他国家传福音。在上帝预备足够同工时，将开拓英语事工，带领更多人归向主，逐渐建立多语言、多民族、多元的基督教会。</li>
			<li>是一间城市教会，在同一城市内不设立分堂，除非路程超过一个半小时；同时积极跟随上帝的带领，在其他城市或国家建立教会。</li>
			<li>是一间在坚持圣经真理原则不变的前提下不断寻求更新，努力成为更强壮、更健康、更有影响力的教会。</li>
			</ol>
			"""),
        new(
            "church-vision",
            "2014-02-06-22-12-16/2014-02-10-08-50-35/2014-02-10-08-35-25.html",
            "Church Vision",
            "教会异象",
            "Six vision statements for a Spirit-empowered church serving its city, nation, and the world.",
            "六项教会异象：靠圣灵能力服事城市、国家与世界。",
            "By the power of the Holy Spirit, we seek to build a healthy church that blesses communities and nations.",
            "靠圣灵的大能，建立健康的教会，祝福社区、城市、国家与世界。",
            $"{AssetOrigin}images/slideshow/IMG_80021.jpg",
            """
			<h2>Our vision</h2>
			<h3>1. By the power of the Holy Spirit</h3>
			<p>To build a healthy church that brings together vibrant worship and biblical teaching in Sunday celebrations, a discipleship training centre, cell groups, and a social care and service centre, influencing the community and the city.</p>
			<h3>2. By the power of the Holy Spirit</h3>
			<p>To lead Chinese immigrants and international students to the Lord, form them as disciples of Jesus Christ, train them for ministry, and send them to proclaim the gospel and establish more churches locally, nationally, and throughout the world.</p>
			<h3>3. By the power of the Holy Spirit</h3>
			<p>When the time is right, to grow into a powerful multilingual and multi-ethnic church that influences society and the nation.</p>
			<h3>4. By the power of the Holy Spirit</h3>
			<p>With the church as their support, to send pastors around the world for itinerant evangelism, spiritual formation, revival, training, and other ministries, becoming a blessing to many more people.</p>
			<h3>5. By the power of the Holy Spirit</h3>
			<p>To encourage churches toward unity and revival under the truth of the cross, actively influencing the nation so that New Zealand is founded on biblical truth and principles.</p>
			<h3>6. By the power of the Holy Spirit</h3>
			<p>To live out the church's five purposes, grow into a church of more than three thousand people, positively influence the world, and glorify God.</p>
			""",
            """
			<h2>教会的异象</h2>
			<h3>一、靠圣灵的大能</h3>
			<p>建立一间健康的教会，包括融合充满活力的敬拜和圣经教导的主日庆典、门徒训练中心、细胞小组及社会关怀服务中心，以此影响社区和城市。</p>
			<h3>二、靠圣灵的大能</h3>
			<p>建立一间带领华人移民和留学生归向主的教会，塑造他们成为耶稣基督的门徒，训练他们投入事工，差派他们在本地、本国及世界各处宣扬基督福音，建立更多上帝的教会。</p>
			<h3>三、靠圣灵的大能</h3>
			<p>在时机成熟时，发展成为一间多语言、多民族、充满上帝大能的教会，影响整个社会和国家。</p>
			<h3>四、靠圣灵的大能</h3>
			<p>以教会为后盾，支持牧者到世界各地从事巡回布道、培灵、奋兴、培训等事工，成为更多人的祝福。</p>
			<h3>五、靠圣灵的大能</h3>
			<p>推动各教会在十字架真理下合一、复兴，积极影响国家，使新西兰成为以圣经真理为基石和原则的国家。</p>
			<h3>六、靠圣灵的大能</h3>
			<p>大力发挥教会五大目标，成为一间超过三千人的教会，积极影响世界，荣耀上帝。</p>
			"""),
        new(
            "statement-of-faith",
            "2014-02-06-22-12-16/2014-02-10-08-50-35/2014-02-10-08-52-11.html",
            "Our Faith",
            "我们的信仰",
            "Fifteen statements summarising the church's biblical Christian faith.",
            "十五项信仰宣言，概述教会所持守的圣经信仰。",
            "We confess the Triune God, salvation through Jesus Christ, the work of the Holy Spirit, and the authority of Scripture.",
            "我们宣认三一上帝、耶稣基督的救恩、圣灵的工作与圣经的权威。",
            $"{AssetOrigin}images/slideshow/thumbnail-21.jpg",
            """
			<h2>Statement of faith</h2>
			<ol>
			<li>We believe that the whole Bible is inspired by God and completely without error. It was written by people under the supernatural guidance of the Holy Spirit and is the highest authority and standard for Christian faith and life (2 Timothy 3:16; 1 Corinthians 2:13).</li>
			<li>We believe that the one true and eternal God has revealed Himself as Father, Son, and Holy Spirit—the Triune God, Creator of all things and Lord who redeems all peoples (Matthew 28:19; 2 Corinthians 13:14).</li>
			<li>We believe that Jesus Christ is God's only Son, conceived by the Holy Spirit and born of the virgin Mary. He is fully God and fully human (Luke 1:26–35; John 1:14–18; Isaiah 7:14; 9:6).</li>
			<li>We believe that Jesus Christ died for our sins, was buried, rose on the third day, ascended to heaven, and will return as He promised (1 Corinthians 15:1–4; Romans 4:25; John 14:2–3; 1 Thessalonians 4:13–18).</li>
			<li>We believe that the Holy Spirit is of one being, authority, honour, and glory with the Father and the Son. He brings believers to new birth and holiness and gives spiritual gifts that remain present today (John 3:5–8; Romans 8:9–13; 1 Corinthians 12:1–11; Romans 12:6–8; Ephesians 4:4–16).</li>
			<li>We believe that humanity was created in God's image but fell into sin through disobedience. People are unable to save themselves and need God's redemption (Genesis 1:26–27; 3:1–7; Romans 5:12,18).</li>
			<li>We believe that people are saved by God's grace through repentance and faith in the saving work Jesus accomplished on the cross (Ephesians 2:8–9; Hebrews 9:12,22).</li>
			<li>We believe that believers should continually be filled with the Holy Spirit, live holy lives distinct from the world, bear the fruit of the Spirit, and receive power to serve the Lord effectively (Ephesians 5:18; 2 Corinthians 6:14; 7:1; Galatians 5:22; Acts 1:8).</li>
			<li>We believe that the church exists to worship God; make disciples and equip the saints to live as witnesses for Christ; share life in small-group fellowship; serve together according to the gifts of the Holy Spirit; proclaim the gospel of the kingdom; and fulfil the Lord's Great Commission (Matthew 5:13–16; 28:18–20; Ephesians 4:11–16; Philippians 2:14–16).</li>
			<li>We believe that the church is the body of Christ. The universal church is made up of born-again believers and is expressed through local churches in different places (Ephesians 4:4,12; 1 Corinthians 12:13; Acts 15:22; Matthew 16:18; 18:15–20).</li>
			<li>We believe that baptism by full immersion in water is the church's primary practice for those who have been born again and saved, while respecting and accepting other forms of baptism (Matthew 28:19; Acts 2:38; 19:1–6).</li>
			<li>We believe that children are an inheritance from God, that dedicating children is pleasing to Him, and that parents are responsible for their spiritual education and for nurturing a godly generation (Psalm 127:3; 1 Samuel 1:21–28; Luke 2:21–23; Proverbs 3:1–4; 13:24).</li>
			<li>We believe that all who are born again and baptised may receive the Lord's Supper, and that each person should examine their conduct when doing so (1 Corinthians 11:28–32; Matthew 26:26–28).</li>
			<li>We believe that the devil is a real spiritual being. He and his angels have been judged and will be thrown into the lake of fire at the end of the age (Matthew 25:41; Revelation 20:10).</li>
			<li>We believe that at the end of the age Christ will return to judge the living and the dead. Those who reject Him will be raised to eternal punishment; believers will be raised to eternal life and reign with Christ for ever (Mark 9:43–48; 2 Thessalonians 1:9; Revelation 20:10–15; 22:5).</li>
			</ol>
			""",
            """
			<h2>我们的信仰</h2>
			<ol>
			<li>我们相信整本圣经是上帝所默示的，完全无误，是借着圣灵超然的引导由人写成；是基督徒信仰和生活的最高权威和准则（提摩太后书 3:16；哥林多前书 2:13）。</li>
			<li>我们相信自有永有、独一的真神启示自己为圣父、圣子和圣灵三位一体的上帝，是创造万有、救赎万民的主（马太福音 28:19；哥林多后书 13:14）。</li>
			<li>我们相信耶稣基督是上帝的独生子，由圣灵感孕，借童贞女马利亚所生；祂是完全的上帝，也是完全的人（路加福音 1:26–35；约翰福音 1:14–18；以赛亚书 7:14；9:6）。</li>
			<li>我们相信耶稣基督为我们的罪受死，埋葬后第三天复活、升天，并照祂所应许的还要再来（哥林多前书 15:1–4；罗马书 4:25；约翰福音 14:2–3；帖撒罗尼迦前书 4:13–18）。</li>
			<li>我们相信圣灵与圣父、圣子同质、同权、同尊、同荣；祂使信徒重生成圣，又赐下各样属灵恩赐，这些恩赐今日仍然存在（约翰福音 3:5–8；罗马书 8:9–13；哥林多前书 12:1–11；罗马书 12:6–8；以弗所书 4:4–16）。</li>
			<li>我们相信人是照着上帝的形象造的，因不顺服上帝而堕落成为罪人，完全无力自救，需要上帝的救赎（创世记 1:26–27；3:1–7；罗马书 5:12,18）。</li>
			<li>我们相信人的得救本乎上帝的恩典，也借着人的悔改并相信耶稣在十字架上所成就的救赎大工（以弗所书 2:8–9；希伯来书 9:12,22）。</li>
			<li>我们相信信徒应不断被圣灵充满，过与世界有别的圣洁生活，结出圣灵的果子，并得着能力，有效地事奉主（以弗所书 5:18；哥林多后书 6:14；7:1；加拉太书 5:22；使徒行传 1:8）。</li>
			<li>我们相信教会存在的目的是敬拜上帝；培育门徒、装备众圣徒，活出基督的见证；过小组团契生活；按照圣灵的恩赐彼此配搭、同心事奉；传扬天国的福音，完成主的大使命（马太福音 5:13–16；28:18–20；以弗所书 4:11–16；腓立比书 2:14–16）。</li>
			<li>我们相信教会是基督的身体。真实的普世教会由重生的信徒组成，并借不同地区的地方教会表达出来（以弗所书 4:4,12；哥林多前书 12:13；使徒行传 15:22；马太福音 16:18；18:15–20）。</li>
			<li>我们相信完全浸入水中的洗礼，是教会为重生得救之人施洗的主要方式，同时也尊重并接纳其他方式的洗礼（马太福音 28:19；使徒行传 2:38；19:1–6）。</li>
			<li>我们相信儿女是上帝所赐的产业，奉献孩童是上帝所喜悦的；父母应尽属灵教育的责任，培养敬虔的后代（诗篇 127:3；撒母耳记上 1:21–28；路加福音 2:21–23；箴言 3:1–4；13:24）。</li>
			<li>我们相信所有重生且受过洗礼的人都可以领受主餐；领主餐时应当省察自己的行为（哥林多前书 11:28–32；马太福音 26:26–28）。</li>
			<li>我们相信魔鬼是一个真实的属灵位格；牠与牠的使者已经被审判，在末日将被扔进火湖（马太福音 25:41；启示录 20:10）。</li>
			<li>我们相信在末日基督将再来，审判活人死人；不信的人复活受永刑，信的人复活得永生，并与基督一同作王，直到永永远远（马可福音 9:43–48；帖撒罗尼迦后书 1:9；启示录 20:10–15；22:5）。</li>
			</ol>
			"""),
        new(
            "church-purposes",
            "2014-02-06-22-12-16/2014-02-10-08-50-35/2014-02-10-08-41-10.html",
            "Church Purposes",
            "教会目标",
            "The church's five biblical purposes and the six historical goals recorded for 2015.",
            "教会的五大圣经目标，以及原网站记录的 2015 年六项目标。",
            "Worship, discipleship, fellowship, ministry, and evangelism express why the church exists.",
            "敬拜、门训、团契、事奉和福音，表达教会存在的目的。",
            $"{AssetOrigin}images/slideshow/thumbnail7.jpg",
            """
			<h2>Biblical foundation</h2>
			<p>The church understands its purpose, mission, and goals through Jesus Christ's Great Commandment (Matthew 22:37–40), Great Commission (Matthew 28:19–20), and great promise of the Holy Spirit's power (Acts 1:8). We depend on the Holy Spirit to fulfil them and so enjoy abundant life.</p>
			<h2>The five purposes of the church</h2>
			<h3>1. Worship — loving God with all our heart</h3>
			<p>The church exists to worship the true God and express our love for Him.</p>
			<p>We long to see a spacious site for Abundant Life Church with a beautiful, well-equipped building that includes a worship centre for thousands of people, a believer-training centre, a prayer centre, and recreation areas.</p>
			<p>We long to see people experience God's powerful presence as they worship—receiving comfort, healing, renewal, and other signs of His work.</p>
			<h3>2. Discipleship</h3>
			<p>The church exists to teach God's people and form them to become more like Christ in thought, character, and action: mature and influential Christians.</p>
			<p>We nurture spiritual maturity through Bible study, small groups, seminars, discipleship training, Sunday celebrations, retreats, and other settings.</p>
			<p>We equip mature Christians to be an influence in family life, work, study, finance, politics, art, education, entertainment, and every other sphere.</p>
			<h3>3. Fellowship</h3>
			<p>The church exists not only to lead people to faith but also to welcome them as members of Christ's family.</p>
			<p>We long to love, serve, and build one another up in this family, learning together and sharing a joyful and peaceful life.</p>
			<h3>4. Ministry — serving together and caring for people</h3>
			<p>The church exists to care for people, meet needs, heal wounds, and express God's love.</p>
			<p>We establish different ministries to care for spiritual, relational, emotional, and physical needs.</p>
			<p>We help believers discover the spiritual gifts and abilities God has given them and equip each person for meaningful ministry.</p>
			<h3>5. Evangelism</h3>
			<p>The church exists to proclaim God's Word and the gospel of Jesus Christ so that others may share in its blessing and receive abundant new life.</p>
			<p>We long to share the gospel with thousands of residents so that people who are wounded, depressed, frustrated, bound, hopeless, or confused may find love, acceptance, help, hope, freedom, forgiveness, and encouragement.</p>
			<p>We long to send missionaries and church workers throughout the world for short-term mission, church planting, long-term residence, and gospel ministry.</p>
			<h2>The five purposes are also purposes for every believer</h2>
			<ul>
			<li><strong>Worship:</strong> God calls me to become His worshipper and to praise Him.</li>
			<li><strong>Discipleship:</strong> God calls me to become like Him and imitate Christ.</li>
			<li><strong>Fellowship:</strong> God calls me to become a member of His family.</li>
			<li><strong>Ministry:</strong> God calls me to serve by His grace and with His gifts.</li>
			<li><strong>Evangelism:</strong> God calls me to carry His love to others.</li>
			</ul>
			<p>As we practise these purposes, we enjoy life and live with meaning.</p>
			<h2>Six historical goals recorded for 2015</h2>
			<ol>
			<li><strong>Lead brothers and sisters into an intimate relationship with God and the joy of being His children.</strong></li>
			<li><strong>Lead brothers and sisters to become spiritual leaders and disciples.</strong></li>
			<li><strong>Actively cultivate the atmosphere of a spiritual family and build a kingdom culture.</strong> In every gathering, cultivate love, warmth, ease, trust, encouragement, and welcome. Let life sincerely express reverence for and pursuit of the Lord, mutual honour, shared testimony, and relationships that care about people's growth.</li>
			<li><strong>Lead every team to carry out ministry and plans systematically and effectively.</strong> Build organised and effective family ministries; develop more co-workers so everyone participates; clarify responsibilities, training, follow-up, improvement, and the development of people; build healthy and effective teams marked by respect for authority, honest communication, transparency, trust, and humility; and remember that ministry serves people's growth and helps them live the five purposes. A special task for that year was a retreat jointly organised by seven Christchurch Chinese churches for Chinese pastors in New Zealand.</li>
			<li><strong>Build together in unity a beautiful temple for the Lord Jesus.</strong> The building was envisioned as a spiritual home and a centre for worship, discipleship, and mission. The recorded plan anticipated construction from June 2015 to June 2016, fundraising in two stages totalling $2.2 million, and a subcommittee to encourage broad participation.</li>
			<li><strong>Establish life centres in China</strong> with fixed locations where local co-workers could be trained and developed.</li>
			</ol>
			<p>The legacy page records that God gave this mission when the church was founded and expresses the prayer that it would be fulfilled.</p>
			""",
            """
			<h2>圣经的教导</h2>
			<p>以主耶稣基督所宣告的最大诫命（马太福音 22:37–40）、最大使命（马太福音 28:19–20）及最大应许（使徒行传 1:8），确认教会存在的目的、使命及目标；并依靠圣灵的能力完成，从而享受丰盛的生命。</p>
			<h2>教会的五大目标</h2>
			<h3>一、敬拜真神——尽心爱上帝</h3>
			<p>教会存在是为了敬拜真神，表达对祂的爱。</p>
			<p>我们渴望看见一块广大的土地作为丰盛生命教会的所在，建有美观、设备齐全的教堂，包括可容纳数千人的敬拜中心、信徒训练中心、祷告中心及休闲区。</p>
			<p>我们渴望看见人们敬拜上帝时经历祂大能的同在，得到安慰、医治、更新等，并见证上帝大能的作为。</p>
			<h3>二、培育门徒</h3>
			<p>教会存在是为了教导上帝的百姓，培育他们在思想、意念、性情和行为上更像基督，成为成熟、有影响力的基督徒。</p>
			<p>我们借着查经、小组、研习会、门徒训练、主日庆典、退修会等方式，造就信徒灵命成熟。</p>
			<p>我们造就成熟的基督徒，使他们在家庭、工作、学业、经济、政治、艺术、教育、娱乐等各方面发挥影响力。</p>
			<h3>三、小组团契</h3>
			<p>教会存在不仅是为了带领人信主，也要让人成为基督大家庭的一分子。</p>
			<p>我们渴望在大家庭中彼此相爱、彼此服事、彼此造就，一起学习，共同享受充满喜乐与和睦的生活。</p>
			<h3>四、同心事奉、关怀牧养</h3>
			<p>教会存在是为了关怀牧养、满足人的需要、医治人的伤痕，并向人表达上帝的爱。</p>
			<p>教会设立不同事工，关怀灵性、感情、情绪、关系及身体上的不同需要。</p>
			<p>教会帮助信徒发掘上帝所赐的各样属灵恩赐与才干，装备每个人参与有意义的事奉。</p>
			<h3>五、广传福音</h3>
			<p>教会存在是为了传扬上帝的话，把基督耶稣的福音告诉人，使人与我们同得福音的好处，得到丰盛的新生命。</p>
			<p>我们渴望与成千上万的居民分享耶稣基督的福音，使受伤、抑郁、受挫、受捆绑、绝望和迷惑的人找到爱、接纳、帮助、希望、自由、赦免和鼓励。</p>
			<p>我们渴望差派许多宣教士与教会工作者到世界各地参与短期宣教、建立教会，或在当地长期居住、传扬福音。</p>
			<h2>教会的五大目标也是信徒的人生目标</h2>
			<ul>
			<li><strong>敬拜真神：</strong>上帝要我成为祂的敬拜者、称颂者。</li>
			<li><strong>培育门徒：</strong>上帝要我成为祂的样式，效法基督。</li>
			<li><strong>小组团契：</strong>上帝要我成为祂家庭的一员。</li>
			<li><strong>同心事奉：</strong>上帝要我靠祂的恩典和恩赐成为事奉者。</li>
			<li><strong>广传福音：</strong>上帝要我成为祂爱的传递者。</li>
			</ul>
			<p>当我们实践这些目标时，就能享受生命的乐趣，活出生命的意义。</p>
			<h2>原网站记录的 2015 年六大目标</h2>
			<ol>
			<li><strong>带领弟兄姐妹与上帝建立亲密关系，享受作上帝的儿女。</strong></li>
			<li><strong>带领弟兄姐妹成为属灵领袖和门徒。</strong></li>
			<li><strong>积极培养属灵大家庭的美好气氛，建造天国文化。</strong>在每一个聚会中培养爱、温馨、轻松、信任、鼓励和拥抱的属灵气氛；让生命真诚流露出敬畏主、追求主、彼此尊荣、分享见证和关心人成长的互动关系。</li>
			<li><strong>带领各团队有系统、有效率地执行圣工和计划。</strong>建造有系统、有效率的家庭事工；培育更多同工，人人参与建造；建立清楚的职责、培训、跟进、改善和人才培养；培养健康有力的团队，以尊重权柄为心态，以真诚沟通为方式，彼此透明、坦诚、信任、谦卑；谨记事工是为了服事人的生命成长，活出五大目标。当年的特别任务，是由基督城七间华人教会联合举办新西兰华人牧者退修会。</li>
			<li><strong>同心合一建造主耶稣荣美的圣殿。</strong>让它成为属灵的家，以及敬拜、门训、宣教等事工的中心，完成上帝托付的使命。原计划记录的工程期为 2015 年 6 月至 2016 年 6 月，分两期筹款，总额为 220 万元，并成立小组委员会鼓励弟兄姐妹共同参与。</li>
			<li><strong>在神州建立生命点，定点训练和培养当地同工。</strong></li>
			</ol>
			<p>原页面记载：教会成立时，上帝就把这使命赐给教会；这是教会的命定，愿早日成就。</p>
			""")
    ];

    public static async Task<int> EnsureSeededAsync(
        AlifeDbContext dbContext,
        Guid churchGroupId,
        Guid creatorMemberId,
        DateTime now,
        CancellationToken cancellationToken = default)
    {
        var pageIds = Pages.ToDictionary(
            seed => seed.Key,
            seed => DeterministicGuid(churchGroupId, $"nzalc-about:{seed.SourcePath}"));
        var existingPageIds = await dbContext.Pages
            .IgnoreQueryFilters()
            .Where(page => pageIds.Values.Contains(page.Id))
            .Select(page => page.Id)
            .ToHashSetAsync(cancellationToken);
        var missingPages = Pages
            .Where(seed => !existingPageIds.Contains(pageIds[seed.Key]))
            .ToList();

        if (missingPages.Count == 0)
        {
            return 0;
        }

        var menu = await FindAboutMenuAsync(dbContext, churchGroupId, cancellationToken);
        if (menu is null)
        {
            var nextMenuSortOrder = (await dbContext.PagePrimaryMenus
                .Select(value => (int?)value.SortOrder)
                .MaxAsync(cancellationToken) ?? -1) + 1;
            menu = new PagePrimaryMenu
            {
                Id = DeterministicGuid(churchGroupId, "nzalc-about:primary-menu"),
                NameJson = TextJson(MenuNameEn, MenuNameZh),
                SortOrder = nextMenuSortOrder,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            await dbContext.PagePrimaryMenus.AddAsync(menu, cancellationToken);
        }
        else if (menu.NameJson != TextJson(MenuNameEn, MenuNameZh))
        {
            menu.NameJson = TextJson(MenuNameEn, MenuNameZh);
            menu.UpdatedUtc = now;
        }

        var nextPageSortOrder = (await dbContext.PagePublicationReviews
            .Where(review =>
                review.PrimaryMenuId == menu.Id &&
                review.Status == PagePublicationReviewStatus.Approved)
            .Select(review => (int?)review.MenuSortOrder)
            .MaxAsync(cancellationToken) ?? -1) + 1;
        var sectionsInserted = 0;

        foreach (var seed in missingPages)
        {
            var pageId = pageIds[seed.Key];
            var menuSortOrder = nextPageSortOrder++;
            var page = new Page
            {
                Id = pageId,
                OwnerGroupId = churchGroupId,
                CreatedByMemberId = creatorMemberId,
                TitleJson = TextJson(seed.TitleEn, seed.TitleZh),
                DescriptionJson = TextJson(seed.DescriptionEn, seed.DescriptionZh),
                TagsJson = JsonSerializer.Serialize(new[] { "about", "nzalc-import", "legacy" }),
                TitleDisplayStyle = "Default",
                Visibility = PageVisibility.Public,
                UpdatedUtc = now
            };
            await dbContext.Pages.AddAsync(page, cancellationToken);

            await dbContext.Sections.AddRangeAsync(
                CreateHeroSection(pageId, seed),
                CreateRichTextSection(pageId, seed));
            sectionsInserted += 2;

            await dbContext.PagePublicationReviews.AddAsync(new PagePublicationReview
            {
                Id = DeterministicGuid(pageId, "publication-review"),
                PageId = pageId,
                Status = PagePublicationReviewStatus.Approved,
                PrimaryMenuId = menu.Id,
                PrimaryMenuNameJson = menu.NameJson,
                MenuSortOrder = menuSortOrder,
                AccessNameJson = TextJson(seed.TitleEn, seed.TitleZh),
                CardImageUrl = seed.HeroImageUrl,
                CardTextJson = TextJson(seed.DescriptionEn, seed.DescriptionZh),
                ReviewedByMemberId = creatorMemberId,
                ReviewedUtc = now,
                CreatedUtc = now,
                UpdatedUtc = now
            }, cancellationToken);
        }

        return sectionsInserted;
    }

    private static Section CreateHeroSection(Guid pageId, PageSeed seed)
    {
        var title = new Dictionary<string, string>
        {
            ["en"] = seed.TitleEn,
            ["zh"] = seed.TitleZh
        };
        var body = new Dictionary<string, string>
        {
            ["en"] = seed.HeroTextEn,
            ["zh"] = seed.HeroTextZh
        };

        return new Section
        {
            Id = DeterministicGuid(pageId, "landing-hero"),
            PageId = pageId,
            Order = 1,
            Type = SectionType.LandingHero,
            ContentJson = JsonSerializer.Serialize(new
            {
                sectionKind = "landingHero",
                spacing = "large",
                header = new
                {
                    title,
                    subtitle = body,
                    align = "left",
                    scale = "feature",
                    tone = "primary"
                },
                backgroundImage = seed.HeroImageUrl,
                backgroundImageUrl = seed.HeroImageUrl,
                posterImage = seed.HeroImageUrl,
                posterImageUrl = seed.HeroImageUrl,
                imageUrl = seed.HeroImageUrl,
                title,
                headline = title,
                centerText = body,
                body,
                subtitle = body,
                subheadline = body
            }),
            StyleJson = JsonSerializer.Serialize(new
            {
                layout = "landingHero",
                frontendType = "LandingHero"
            })
        };
    }

    private static Section CreateRichTextSection(Guid pageId, PageSeed seed)
        => new()
        {
            Id = DeterministicGuid(pageId, "rich-text"),
            PageId = pageId,
            Order = 2,
            Type = SectionType.RichText,
            ContentJson = JsonSerializer.Serialize(new
            {
                spacing = "normal",
                sourceUrl = $"{AssetOrigin}{seed.SourcePath}",
                text = new Dictionary<string, string>
                {
                    ["en"] = seed.BodyEn,
                    ["zh"] = seed.BodyZh
                }
            }),
            StyleJson = "{}"
        };

    private static async Task<PagePrimaryMenu?> FindAboutMenuAsync(
        AlifeDbContext dbContext,
        Guid churchGroupId,
        CancellationToken cancellationToken)
    {
        var deterministicId = DeterministicGuid(churchGroupId, "nzalc-about:primary-menu");
        var deterministicMenu = await dbContext.PagePrimaryMenus
            .FirstOrDefaultAsync(menu => menu.Id == deterministicId, cancellationToken);
        if (deterministicMenu is not null)
        {
            return deterministicMenu;
        }

        var menus = await dbContext.PagePrimaryMenus
            .OrderBy(menu => menu.SortOrder)
            .ToListAsync(cancellationToken);
        return menus.FirstOrDefault(menu =>
        {
            var name = ReadTextMap(menu.NameJson);
            var chineseName = name.GetValueOrDefault("zh");
            return string.Equals(name.GetValueOrDefault("en"), MenuNameEn, StringComparison.OrdinalIgnoreCase) &&
                   (string.Equals(chineseName, MenuNameZh, StringComparison.Ordinal) ||
                    string.Equals(chineseName, "關於我們", StringComparison.Ordinal));
        });
    }

    private static string TextJson(string en, string zh)
        => JsonSerializer.Serialize(new Dictionary<string, string>
        {
            ["en"] = en,
            ["zh"] = zh
        });

    private static IReadOnlyDictionary<string, string> ReadTextMap(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string>>(json) ?? new Dictionary<string, string>();
        }
        catch (JsonException)
        {
            return new Dictionary<string, string>();
        }
    }

    private static Guid DeterministicGuid(Guid id, string salt)
    {
        var bytes = System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes($"{id:N}:{salt}"));
        return new Guid(bytes[..16]);
    }
}
