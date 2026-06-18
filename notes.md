1 Adet Raspberry pi 5(Bundan sonra pi5 olarak adlandırılacak), 
2 Adet Arduino Nano(Bundan sonra nano1 veya nano2 olarak adlandırılacak). 
1 adet 8 kanallı röle kartı.
2 adet lazer sayıcı sensör(Bundan sonra Giriş Sayacı, Çıkış Sayacı olarak adlandırılacak).
2 adet nema 14 motor(Bundan sonra Giriş Kilidi,  Çıkış Kilidi olarak adlandırılacak).
1 Adet Ultrasonik sensör.
1 Adet Selenoid Vana.

Nano 1; 8 kanallı röle kartı kontrolünü yönetecek.
Nano 2; Giriş kilidi, Çıkış kilidi, Giriş sayacı, Çıkış sayacı, Ultrasonik sensör, Selenoid Vanayı kontrol edecek.

Gazoz Fabrikasının Şerbet dolum hattı için çalışacak. Döngümüz şöyle Sürekli çalışan Konveyör bant sistemi ile yıkanmış şişeler Şerbet dolum alanına taşınıyor. Sistemde adı A olan bir Reçete var bu reçetede tanımlı değerler ile dolum yapılacak. Örneğin 8 adet şişeye 40 ml şerbet dolacak. Sistem otomatik modda ise Giriş kilidi açık, çıkış kilidi kapalı pozisyonda Giriş Sayacı önünden geçen şişeleri sayıyor. giren şişe sayısı 8 adet olduğunda giriş kilidi kapatılıyor. 1 saniye sonra belirlenen süre kadar 8 kanallı röle açılıyor örneğin 600ms şişeler 40 ml şerbet ile dolduktan sonra 1 sn bekleniyor. çıkış kilidi açılarak şişelerin diğer hatta gitmesi sağlanılıyor. çıkan şişeler çıkış sayacı tarafından sayılıyor. giren ve çıkan şişe sayısı eşitlendiğinde. döngü başa alınıyor. Yani çıkış kilidi kapatılıyor, giriş kilidi açılıyor. olay bu şekilde devam ediyor. 

Sorular:

1. "Giriş Kilidi" ve "Çıkış Kilidi" Fiziksel Nasıl Çalışıyor?
Bu kilitler konveyör bandın üzerine inen mekanik kol/stopper mı? (Örneğin şişenin önüne metal bir çubuk iniyor)

Yoksa Nema 14 motorlar, döner bariyer görevi mi görüyor (örneğin şişelerin geçişini dönen bir plaka ile engelliyor)?

Kritik soru: Eğer motor step motor ise, kilit açık/kapalı pozisyonlarını nasıl koruyacaksınız? (Step motor sürekli akım çeker, ısınır. Mekanik bir mandal var mı, yoksa motora sürekli "tut" komutu mu göndereceksiniz?)

2. Giriş Sayacı Çıkış Sayacı Yerleşimi ve "Fazla Sayma" Sorunu
Konveyor sürekli çalıştığı için, bir şişe lazerin önünden geçerken lazer ışınını uzun süre kesebilir (örneğin 0.2 saniye).

Bu sürede Nano/Pi5 tek bir kesinti mi algılayacak, yoksa şişe geçene kadar sürekli sinyal mi gelecek?

Kritik soru: Sayma işlemini yükselen kenar (RISING) göre mi, yoksa alçalan kenar (FALLING) göre mi yapacaksınız? (Aksi halde 1 şişeyi 10 kere sayabilir.)

3. 8 Şişe Dolum Alanına Nasıl Sığıyor? (Fiziksel Düzen)
8 adet şişe, giriş kilidi ile çıkış kilidi arasında aynı anda mı duruyor?

Eğer öyleyse, giriş stopperi açıkken arka arkaya gelen 8 şişe, çıkış stopperi kapalı olduğu için önlerindeki şişelere çarparak zincirleme sıkışma yapar mı?

Kritik soru: Konveyör hızı belli mi? 8. şişe içeri girdiğinde, 1. şişe çıkış kilidine dayanmış oluyor mu? Yoksa 8 şişe sığabilecek bir birikim alanı (akümülasyon hattı) mı var?

4. Röle Açılma Süresi (600ms) Nasıl Belirlendi?
600ms boyunca röle açık kalacak. Bu röle, selenoid vanayı mı kontrol ediyor (şerbet akışını başlatıp durduruyor)?

Eğer öyleyse, 8 şişenin hepsine aynı anda mı şerbet basılıyor? (yani tek bir büyük manifold mu var?)

Yoksa 8 kanallı röle, 8 ayrı dolum başlığını mı kontrol ediyor (her şişe için 1 röle kanalı)?

Kritik soru: 600ms sonunda röle kapanınca, şişelerin üzerine damlayan son şerbet damlaları ne olacak? (Bu, ürün israfına yol açar, genelde "damla tutucu" eklenir.)

5. "1 Saniye Bekleme" Sürelerinin Amacı Ne?
Giriş kapandıktan sonra 1 saniye bekleniyor. Bu bekleme, konveyör titreşiminin durması ve şişelerin tam dolum başlığının altında hizalanması için mi?

Dolum bittikten sonraki 1 saniye bekleme, şerbetin köpürmesini söndürmek veya damlaların akması için mi?

Kritik soru: Bu süreler reçeteye (Reçete A) bağlı mı? Farklı reçetelerde (örneğin 12 şişe 50 ml) bu bekleme süreleri değişecek mi?

6. Manuel Mod ve Acil Durum
"Sistem otomatik modda" dediniz. Peki manuel mod da var mı? (Örneğin operatör butonla kapıları açıp kapatabilmeli mi?)

Konveyör sürekli çalışıyor ama ya sistemin önünde veya arkasında şişe yoksa? (Giriş sayacı 8'den az sayıda şişe görürse sonsuza kadar bekler mi, yoksa zaman aşımı (timeout) ile arıza mı verir?)

7. Reçete A'nın İçinde Neler Var?
Sadece "8 adet şişe" ve "40 ml" mi var?

Yoksa dolum süresi (600ms) ve bekleme süreleri (1sn) de reçeteye mi dahil? (Çünkü farklı şerbet viskoziteleri farklı akış hızı yaratır, o yüzden süre de reçetede olmalıdır.)

Reçete değişimi sırasında (örneğin A'dan B'ye geçerken) sistem boşta mı kalacak, yoksa hattaki mevcut şişeler bitene kadar eski reçete mi devam edecek?

Cevaplar:

1. Giriş Çıkış kilidi nema 14 step motor ile kontrol ediliyor. ileri geri hareket eden bariyer gibi, sadece kilidin açık olduğu durumda çalışan optik limit switch var. onunla durumunu takip ediyorum. 
2. Lazer sensör düşen kenarda sayıyor. Nano2 A0,A1 pinleri ile kontrol ediliyorlar. A0 Giriş Sayacı, 
A1 çıkış sayacı. 
3. Evet aynı anda duruyor. Evet şişeler bir birini sıkıştırıyor. evet 8 şişe girdiğinde 1.  şişe çıkış kilidine dayanmış oluyor. 
4. 600 ms hesaplama yapıldı. manifold ile 8 şişeye aynı anda şerbet dolumu yapılıyor. Damla tutucu yok önerirsen iyi olur. 
5. Konveyör hızı nedeni ile son şişenin yerine gelme süresi, Evet köpürme ve varsa son damla için, Evet her reçete kendine özel değerler taşıyor. 
6. Evet otomatik modun yarı otomatik hali, Operatör bunu kendisi ayarlayabiliyor. arayüzden giriş çıkış kilitve sayaçlarını kontrol edebiliyor. 
7. Hayır sınırsız reçete tanımlanabilir. 600ms 40ml şerbet için, başka bir reçetede 4 şişe 20ml olabilir. Hatta ki döngü bitmeden reçete değişimi yapılamaz. 

Doğru akış diyagramı, iş akış algoritması istiyorum.

1. SİSTEM ANA AKIŞ FLOWCHART
2. DURUM GEÇİŞ DİYAGRAMI (STATE TRANSITION)
3. KARAR AĞACI (DECISION TREE) - HATA YÖNETİMİ
4. ZAMANLAMA DİYAGRAMI (TIMING DIAGRAM)
5. KARAR TABLOSU (DECISION TABLE)
6. ALTERNATİF AKIŞ - YARI OTOMATİK MOD
7. ÖZET DURUM GEÇİŞ MATRİSİ